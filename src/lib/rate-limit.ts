import { createHash } from 'crypto';

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

// In-memory per-process limiter. Resets on server restart and is per-instance,
// so it doesn't protect against distributed abuse across multiple Vercel instances.
// Adequate for low-traffic launch. Replace with Upstash Redis when traffic scales.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function utcMidnightMs(): number {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() + 86_400_000;
}

export function checkInMemoryLimit(ipHash: string, limit: number): boolean {
  const now = Date.now();
  const resetAt = utcMidnightMs();
  const bucket = buckets.get(ipHash);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(ipHash, { count: 1, resetAt });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}
