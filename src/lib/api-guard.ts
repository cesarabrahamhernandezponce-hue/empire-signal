import { createHash, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// The single response for "our backend is down, and it isn't your fault". Used
// wherever a fail-closed rate-limit check blocks a request because the database
// was unreachable: a 429 there would blame the user for a quota they never spent
// and push them toward a signup that is just as broken. 503 + Retry-After is the
// honest answer and keeps crawlers from hammering an outage.
export function serviceUnavailable(): NextResponse {
  return NextResponse.json(
    { error: 'service_unavailable' },
    { status: 503, headers: { 'Retry-After': '60' } },
  );
}

// Constant-time owner-key check. Hashing both sides to a fixed-length digest
// before comparing means the comparison leaks neither the key's length nor any
// prefix via timing — unlike a plain `===`, which short-circuits on first
// mismatch. The key only grants a rate-limit bypass, but it's cheap to do right.
export function isOwnerRequest(request: Request): boolean {
  const provided = request.headers.get('x-owner-key');
  const expected = process.env.OWNER_BYPASS_KEY;
  if (!expected || !provided) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

// True when `email` is the owner's account (OWNER_EMAIL). Sync so routes that
// already loaded the session can bypass limits without a second auth round-trip.
export function isOwnerEmail(email: string | null | undefined): boolean {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return !!owner && !!email && email.trim().toLowerCase() === owner;
}

// Owner bypass for any metered route: the secret header OR the signed-in owner
// account. Pass `knownEmail` when the handler already fetched the user so we
// don't call getUser twice; omit it and this resolves the session itself. For
// anonymous requests (no auth cookie) getUser returns null with no network hit,
// so this stays cheap on the hot path.
export async function isOwner(
  request: Request,
  knownEmail?: string | null,
): Promise<boolean> {
  if (isOwnerRequest(request)) return true;
  if (!process.env.OWNER_EMAIL) return false;
  if (knownEmail !== undefined) return isOwnerEmail(knownEmail);
  try {
    const supabase = await createClient();
    const email = supabase ? (await supabase.auth.getUser()).data.user?.email : null;
    return isOwnerEmail(email);
  } catch {
    return false;
  }
}

// Every JSON payload this app accepts is tiny (a word + optional short context).
// 16 KB is generous headroom while still rejecting multi-MB floods before they
// reach JSON.parse.
const MAX_BODY_BYTES = 16 * 1024;

export type BodyResult =
  | { ok: true; body: unknown }
  | { ok: false; status: number; error: string };

// Reads and parses a JSON body with a hard size cap. Reading the text first and
// measuring it (rather than trusting the Content-Length header, which can be
// absent on chunked uploads or spoofed) means the cap actually holds.
export async function readJsonBody(
  request: Request,
  maxBytes: number = MAX_BODY_BYTES,
): Promise<BodyResult> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400, error: 'Could not read request body.' };
  }
  if (text.length > maxBytes) {
    return { ok: false, status: 413, error: 'Request body too large.' };
  }
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON body.' };
  }
}
