import { createHash, timingSafeEqual } from 'crypto';

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
