import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';

const bodySchema = z.object({
  email: z.string().trim().email().transform((e) => e.toLowerCase()),
});

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    const { email } = parsed.data;

    try {
      await prisma.waitlistEmail.create({ data: { email } });
      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (err: unknown) {
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
