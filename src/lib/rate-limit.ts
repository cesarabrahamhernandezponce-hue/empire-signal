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

export type LimitResult = { allowed: boolean; remaining: number; limit: number };

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

export function checkInMemoryLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const resetAt = utcMidnightMs();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

function startOfCurrentMonthUTC(): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function checkAnonymousLimit(ipHash: string): Promise<LimitResult> {
  // Fast path: reject immediately if in-memory bucket is full.
  if (!checkInMemoryLimit(`analyze:${ipHash}`, ANON_DAILY_LIMIT)) {
    return { allowed: false, remaining: 0, limit: ANON_DAILY_LIMIT };
  }
  // Authoritative cross-instance count from DB.
  try {
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    const count = await prisma.searchEvent.count({
      where: { ipHash, cacheHit: false, createdAt: { gte: todayUtc } },
    });
    const remaining = Math.max(0, ANON_DAILY_LIMIT - count);
    return { allowed: count < ANON_DAILY_LIMIT, remaining, limit: ANON_DAILY_LIMIT };
  } catch (err) {
    // DB unreachable — in-memory check already passed, fail open.
    console.error('[rate-limit] Anonymous DB count failed, relying on in-memory check:', err);
    return { allowed: true, remaining: ANON_DAILY_LIMIT - 1, limit: ANON_DAILY_LIMIT };
  }
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
): Promise<boolean> {
  // Cheap fast path: short-circuit obvious per-instance floods without a DB hit.
  if (!checkInMemoryLimit(`${scope}:${ipHash}`, limit)) return false;
  try {
    const since = new Date(Date.now() - windowMs);
    const count = await prisma.rateLimitEvent.count({
      where: { scope, ipHash, createdAt: { gte: since } },
    });
    if (count >= limit) return false;
    await prisma.rateLimitEvent.create({ data: { scope, ipHash } });
    return true;
  } catch (err) {
    // Table missing (pre-migration) or DB unreachable — the in-memory check
    // already passed, so fail open rather than block legitimate users.
    console.error(`[rate-limit] DB limit check failed for scope=${scope}, relying on in-memory:`, err);
    return true;
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
    return { allowed: count < USER_MONTHLY_LIMIT, remaining, limit: USER_MONTHLY_LIMIT };
  } catch (err) {
    // Never block a user because the rate-limiter couldn't count — fail open.
    console.warn('[rate-limit] User monthly DB count failed, failing open:', err);
    return { allowed: true, remaining: USER_MONTHLY_LIMIT, limit: USER_MONTHLY_LIMIT };
  }
}
