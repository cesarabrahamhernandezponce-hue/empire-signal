import { NextResponse } from 'next/server';
import { z } from 'zod';

import { generateContent } from '@/lib/ai/client';
import { stripJsonFences } from '@/lib/ai/json';
import { buildValidatePromptEN } from '@/lib/ai/prompts/validate-en';
import { buildValidatePromptES } from '@/lib/ai/prompts/validate-es';
import { getClientIp, hashIp, checkDbLimit } from '@/lib/rate-limit';
import { isOwner, readJsonBody } from '@/lib/api-guard';

// A cold AI generation can exceed Vercel's default function limit; raise it so
// slow validations complete instead of being cut off.
export const maxDuration = 60;

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

    const { sentence, word, language } = parsed.data;

    // Require the word at a word boundary rather than a raw substring: a plain
    // includes() accepts "care" inside "scarecrow" (false positive that wastes an
    // AI call). A *leading* boundary preceded by start-of-string or a non-letter
    // still allows legitimate inflections ("run" → "running", "cat" → "cats").
    // \p{L} keeps it accent-aware for Spanish.
    const escapedWord = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordBoundaryRe = new RegExp(`(^|[^\\p{L}])${escapedWord}`, 'iu');
    const wordInSentence = wordBoundaryRe.test(sentence.toLowerCase());
    if (!wordInSentence) {
      return NextResponse.json(
        { error: language === 'es'
            ? `La oración debe contener la palabra "${word}".`
            : `The sentence must contain the word "${word}".`
        },
        { status: 422 },
      );
    }

    if (!(await isOwner(request))) {
      const ipHash = hashIp(getClientIp(request));
      if (!(await checkDbLimit('validate', ipHash, DAILY_LIMIT))) {
        return NextResponse.json(
          { error: 'Daily limit reached. Come back tomorrow.' },
          { status: 429 },
        );
      }
    }

    const prompt = language === 'es'
      ? buildValidatePromptES(sentence, word)
      : buildValidatePromptEN(sentence, word);

    // temperature:0 so the same sentence gets the same score on a retry — the
    // prompt promises determinism, and a wandering score erodes trust. maxTokens
    // is small: the response is a short verdict object.
    const aiResult = await generateContent(prompt, { temperature: 0, maxTokens: 800 });
    if (!aiResult.ok) {
      return NextResponse.json({ error: aiResult.error }, { status: 503 });
    }

    let raw: unknown;
    try {
      raw = JSON.parse(stripJsonFences(aiResult.text));
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
