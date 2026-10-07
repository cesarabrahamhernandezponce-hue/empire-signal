import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { getClientIp, hashIp, checkDbLimit } from '@/lib/rate-limit';
import { readJsonBody, serviceUnavailable } from '@/lib/api-guard';

const bodySchema = z.object({
  email: z.string().trim().email().transform((e) => e.toLowerCase()),
});

const DAILY_LIMIT = 10;

export async function POST(request: Request) {
  try {
    const bodyResult = await readJsonBody(request);
    if (!bodyResult.ok) {
      return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
    }

    const parsed = bodySchema.safeParse(bodyResult.body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    const { email } = parsed.data;

    // Cap submissions per IP/day so this unauthenticated writer can't be flooded.
    const ipHash = hashIp(getClientIp(request));
    const gate = await checkDbLimit('waitlist', ipHash, DAILY_LIMIT);
    if (gate === 'unavailable') return serviceUnavailable();
    if (gate === 'limit_reached') {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    try {
      await prisma.waitlistEmail.create({ data: { email } });
      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (err: unknown) {
      // 409 drives the "you're already on the list" UX. Enumerating who's on a
      // pre-launch waitlist is low-value, so we keep the friendly signal; the
      // per-IP limiter above already blocks the real risk (flooding the table).
      if ((err as { code?: string }).code === 'P2002') {
        return NextResponse.json({ error: 'Email already registered.' }, { status: 409 });
      }
      throw err;
    }
  } catch (err) {
    console.error('[POST /api/signal/waitlist] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
