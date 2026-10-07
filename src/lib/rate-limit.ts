import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

export function getClientIp(request: Request): string {
  // On Vercel, `x-real-ip` is set by the platform to the real client IP and any
  // inbound value the client sends is overwritten — so it's the authoritative
  // source. Only fall back to the *leftmost* `x-forwarded-for` entry (the
  // original client) when `x-real-ip` is absent. NOTE: this assumes the app runs
  // behind Vercel's proxy; on a bare deployment these headers are client-spoofable
  // and rate limiting must not be relied upon as a hard security boundary.
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

// `reason` explains a rejection. 'limit_reached' means the user genuinely spent
// their quota; 'unavailable' means the DB couldn't be counted and we failed
// closed. Both block the request, but only the first is the user's fault — the
// caller must not tell someone they hit a limit they never reached.
export type LimitDenial = 'limit_reached' | 'unavailable';
export type LimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  reason?: LimitDenial;
};

// Same distinction for the boolean-style limiter used by the metered AI routes.
export type DbLimitOutcome = 'allowed' | LimitDenial;

// Postgres raises a serialization failure (SQLSTATE 40001) under Serializable
// isolation when two transactions conflict; Prisma surfaces it as code P2034.
function isSerializationFailure(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2034'
  );
}

const ANON_DAILY_LIMIT = 5;
const USER_MONTHLY_LIMIT = 30;

// In-memory per-process fast path — ephemeral and per-instance.
// Only authoritative for anonymous users within a single process lifetime.
// For registered users the DB count is the sole authority.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function utcMidnightMs(): number {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() + 86_400_000;
}

// Read-only: is this key still under the limit? Does not mutate the bucket, so
// it's safe to call before we know whether the request will succeed.
function peekInMemoryLimit(key: string, limit: number): boolean {
  const bucket = buckets.get(key);
  if (!bucket || Date.now() >= bucket.resetAt) return true;
  return bucket.count < limit;
}

// Commit one consumed unit to the per-instance bucket. Kept separate from the
// peek so callers can charge the quota only after a request actually succeeds.
function recordInMemory(key: string): void {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: utcMidnightMs() });
  } else {
    bucket.count++;
  }
}

function checkInMemoryLimit(key: string, limit: number): boolean {
  if (!peekInMemoryLimit(key, limit)) return false;
  recordInMemory(key);
  return true;
}

function startOfCurrentMonthUTC(): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function checkAnonymousLimit(ipHash: string): Promise<LimitResult> {
  // Fast path: reject immediately if in-memory bucket is full. Read-only on
  // purpose — a request only consumes the quota once it SUCCEEDS (the caller
  // then calls recordAnonymousSearch). Otherwise a failed analysis (AI 503,
  // word-not-found, parse error) would inflate this bucket and lock the user
  // out even though no search was ever recorded in the DB.
  if (!peekInMemoryLimit(`analyze:${ipHash}`, ANON_DAILY_LIMIT)) {
    return { allowed: false, remaining: 0, limit: ANON_DAILY_LIMIT, reason: 'limit_reached' };
  }
  // Authoritative cross-instance count from DB.
  try {
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    // Count EVERY anonymous search today — cache hits included. The anon limit
    // exists to drive signup, not just to cap AI cost, so popular pre-cached words
    // must count too. userId: null scopes the tally to anonymous events, so a
    // registered user sharing the same IP doesn't consume the anon quota.
    const count = await prisma.searchEvent.count({
      where: { ipHash, userId: null, createdAt: { gte: todayUtc } },
    });
    const remaining = Math.max(0, ANON_DAILY_LIMIT - count);
    const allowed = count < ANON_DAILY_LIMIT;
    return {
      allowed,
      remaining,
      limit: ANON_DAILY_LIMIT,
      ...(allowed ? {} : { reason: 'limit_reached' as const }),
    };
  } catch (err) {
    // Fail closed: when the DB is unreachable the cache is too, so every analysis
    // becomes a real AI call. On a cold serverless instance the in-memory bucket
    // is empty and can't backstop the count, so allowing the request through would
    // let anonymous traffic drain the free AI budget uncapped during an outage.
    // Block instead — matching checkDbLimit's fail-closed stance for metered calls.
    // `reason` keeps the outage distinguishable from a real limit so the caller
    // can answer 503 instead of accusing the user of spending a quota they didn't.
    console.error('[rate-limit] Anonymous DB count failed, failing closed:', err);
    return { allowed: false, remaining: 0, limit: ANON_DAILY_LIMIT, reason: 'unavailable' };
  }
}

// Charge one anonymous search against the per-instance bucket. Called only
// after analyzeWord succeeds (when a SearchEvent row is also written), so the
// in-memory fast-path stays consistent with the DB tally: failed attempts,
// which write no SearchEvent, likewise cost nothing here.
export function recordAnonymousSearch(ipHash: string): void {
  recordInMemory(`analyze:${ipHash}`);
}

// Durable, cross-instance limiter for the AI endpoints (ask/translate/validate).
// Records one row per metered request and counts within a rolling window, so the
// cap survives serverless cold starts (unlike checkInMemoryLimit alone). The
// in-memory check is kept only as a cheap per-instance pre-filter against floods.
export async function checkDbLimit(
  scope: string,
  ipHash: string,
  limit: number,
  windowMs: number = 86_400_000,
): Promise<DbLimitOutcome> {
  // Cheap fast path: short-circuit obvious per-instance floods without a DB hit.
  if (!checkInMemoryLimit(`${scope}:${ipHash}`, limit)) return 'limit_reached';
  try {
    const since = new Date(Date.now() - windowMs);
    // Insert-then-count inside a Serializable transaction so concurrent requests
    // from the same IP can't both read "under the limit" and slip through: the
    // insert makes each tx's count include its own row, and Serializable forces
    // one of two overlapping counts to abort (P2034) instead of both winning.
    // A plain count()+create() is a TOCTOU race that lets a burst exceed the cap
    // and drain the free AI budget. One retry absorbs a benign serialization
    // conflict; anything past that fails closed (reject) to protect the budget.
    const runTxn = () =>
      prisma.$transaction(
        async (tx) => {
          await tx.rateLimitEvent.create({ data: { scope, ipHash } });
          const count = await tx.rateLimitEvent.count({
            where: { scope, ipHash, createdAt: { gte: since } },
          });
          return count <= limit;
        },
        { isolationLevel: 'Serializable' },
      );

    const runOnce = async (): Promise<DbLimitOutcome> =>
      (await runTxn()) ? 'allowed' : 'limit_reached';

    try {
      return await runOnce();
    } catch (txErr) {
      if (isSerializationFailure(txErr)) return await runOnce();
      throw txErr;
    }
  } catch (err) {
    // Fail closed: if the DB is unreachable we can't enforce the cross-instance
    // cap, so we block the metered AI call rather than let it through. Protects
    // the free Gemini/OpenRouter budget when Supabase blinks, at the cost of
    // temporarily denying these endpoints during an outage. Reported as
    // 'unavailable', not 'limit_reached' — the user spent nothing.
    console.error(`[rate-limit] DB limit check failed for scope=${scope}, failing closed:`, err);
    return 'unavailable';
  }
}

export async function checkUserLimit(userId: string): Promise<LimitResult> {
  // DB is the sole authority — no in-memory fast path (Vercel instances are ephemeral).
  try {
    const monthStart = startOfCurrentMonthUTC();
    const count = await prisma.searchEvent.count({
      where: { userId, cacheHit: false, createdAt: { gte: monthStart } },
    });
    const remaining = Math.max(0, USER_MONTHLY_LIMIT - count);
    const allowed = count < USER_MONTHLY_LIMIT;
    return {
      allowed,
      remaining,
      limit: USER_MONTHLY_LIMIT,
      ...(allowed ? {} : { reason: 'limit_reached' as const }),
    };
  } catch (err) {
    // Never block a user because the rate-limiter couldn't count — fail open.
    console.warn('[rate-limit] User monthly DB count failed, failing open:', err);
    return { allowed: true, remaining: USER_MONTHLY_LIMIT, limit: USER_MONTHLY_LIMIT };
  }
}
