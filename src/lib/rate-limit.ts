import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';

export function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

export function getClientIp(request: Request): string {
  // x-real-ip is set by Vercel to the actual client IP (not spoofable by client).
  // x-forwarded-for leftmost entry is client-controlled; take rightmost as fallback.
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() ??
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
