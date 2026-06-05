import { NextResponse } from 'next/server';
import { z } from 'zod';

import { generateContent } from '@/lib/ai/client';
import { buildValidatePromptEN } from '@/lib/ai/prompts/validate-en';
import { buildValidatePromptES } from '@/lib/ai/prompts/validate-es';
import { getClientIp, hashIp, checkInMemoryLimit } from '@/lib/rate-limit';

const DAILY_LIMIT = 20;

const bodySchema = z.object({
  sentence: z.string().min(1).max(300).trim(),
  word:     z.string().min(1).max(40).trim(),
  language: z.enum(['en', 'es']).default('en'),
});

const responseSchema = z.object({
  natural:    z.boolean(),
  score:      z.number().min(0).max(100).transform(Math.round),
  feedback:   z.string(),
  suggestion: z.string().nullable().optional().transform((v) => v ?? undefined),
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

    const { sentence, word, language } = parsed.data;

    const wordInSentence = sentence.toLowerCase().includes(word.toLowerCase());
    if (!wordInSentence) {
      return NextResponse.json(
        { error: language === 'es'
            ? `La oración debe contener la palabra "${word}".`
            : `The sentence must contain the word "${word}".`
        },
        { status: 422 },
      );
    }

    const ownerKey = request.headers.get('x-owner-key');
    const bypassKey = process.env.OWNER_BYPASS_KEY;
    const isOwner = Boolean(bypassKey && ownerKey === bypassKey);

    if (!isOwner) {
      const ipHash = hashIp(getClientIp(request));
      const allowed = checkInMemoryLimit(`validate:${ipHash}`, DAILY_LIMIT);
      if (!allowed) {
        return NextResponse.json(
          { error: 'Daily limit reached. Come back tomorrow.' },
          { status: 429 },
        );
      }
    }

    const prompt = language === 'es'
      ? buildValidatePromptES(sentence, word)
      : buildValidatePromptEN(sentence, word);

    const aiResult = await generateContent(prompt);
    if (!aiResult.ok) {
      return NextResponse.json({ error: aiResult.error }, { status: 503 });
    }

    let raw: unknown;
    try {
      raw = JSON.parse(aiResult.text);
    } catch {
      return NextResponse.json({ error: 'Invalid AI response format.' }, { status: 502 });
    }

    const validated = responseSchema.safeParse(raw);
    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid AI response structure.' }, { status: 502 });
    }

    return NextResponse.json(validated.data, { status: 200 });
  } catch (err) {
    console.error('[POST /api/signal/validate] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
