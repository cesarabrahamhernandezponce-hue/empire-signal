import { NextResponse } from 'next/server';
import { z } from 'zod';

import { translateWord } from '@/lib/services/signal';
import { getClientIp, hashIp, checkInMemoryLimit } from '@/lib/rate-limit';

const DAILY_LIMIT = 30;

const bodySchema = z.object({
  word:            z.string().min(1).max(100).trim(),
  targetLanguages: z.array(z.enum(['en', 'es', 'fr', 'de', 'zh'])).min(1),
  tone:            z.enum(['formal', 'informal', 'neutral']).default('neutral'),
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
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { error: `Invalid parameters: ${first.path.join('.') || 'body'} — ${first.message}` },
        { status: 400 },
      );
    }

    const { word, targetLanguages, tone } = parsed.data;

    const ipHash = hashIp(getClientIp(request));
    if (!checkInMemoryLimit(ipHash, DAILY_LIMIT)) {
      return NextResponse.json({ error: 'Daily limit reached. Come back tomorrow.' }, { status: 429 });
    }

    const result = await translateWord({ word, targetLanguages, tone });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ translations: result.translations }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/signal/translate] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
