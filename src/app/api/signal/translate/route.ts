import { NextResponse } from 'next/server';
import { z } from 'zod';

import { translateWord } from '@/lib/services/signal';
import { getClientIp, hashIp, checkDbLimit } from '@/lib/rate-limit';
import { isOwner, readJsonBody } from '@/lib/api-guard';

const DAILY_LIMIT = 30;

const bodySchema = z.object({
  word:            z.string().min(1).max(100).trim(),
  targetLanguages: z.array(z.enum(['en', 'es', 'fr', 'de', 'zh', 'it', 'pt', 'ru', 'ja', 'ar', 'ko', 'hi', 'nl', 'pl', 'tr', 'sv', 'uk'])).min(1),
  tone:            z.enum(['formal', 'informal', 'neutral']).default('neutral'),
});

export async function POST(request: Request) {
  try {
    const bodyResult = await readJsonBody(request);
    if (!bodyResult.ok) {
      return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
    }

    const parsed = bodySchema.safeParse(bodyResult.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { error: `Invalid parameters: ${first.path.join('.') || 'body'} — ${first.message}` },
        { status: 400 },
      );
    }

    const { word, targetLanguages, tone } = parsed.data;

    if (!(await isOwner(request))) {
      const ipHash = hashIp(getClientIp(request));
      if (!(await checkDbLimit('translate', ipHash, DAILY_LIMIT))) {
        return NextResponse.json({ error: 'Daily limit reached. Come back tomorrow.' }, { status: 429 });
      }
    }

    const result = await translateWord({ word, targetLanguages, tone });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }

    return NextResponse.json({ translations: result.translations }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/signal/translate] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
