import { NextResponse } from 'next/server';
import { z } from 'zod';

import { analyzeWithLens } from '@/lib/services/lens';
import { getClientIp, hashIp, checkDbLimit } from '@/lib/rate-limit';
import { isOwner, readJsonBody } from '@/lib/api-guard';

// One Lens call is a heavy ~250-word generation that easily exceeds Vercel's
// default function limit; raise it so the generation completes instead of being cut off.
export const maxDuration = 60;

// Each Lens call is one heavy ~250-word generation, so it's capped tighter than
// analyze (5/day). Durable + fail-closed via checkDbLimit, with the owner bypass.
const DAILY_LIMIT = 3;
const MAX_WORDS = 400;
const MIN_WORDS = 5;

const bodySchema = z.object({
  // Char cap is a coarse guard (400 words is comfortably under this); the real
  // word-count check runs below so we can return a precise, friendly message.
  text:     z.string().min(1).max(6000),
  language: z.enum(['en', 'es']).default('en'),
});

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

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

    const { text, language } = parsed.data;
    const isES = language === 'es';

    const words = countWords(text);
    if (words > MAX_WORDS) {
      return NextResponse.json(
        { error: isES
            ? `El texto supera el límite de ${MAX_WORDS} palabras (tienes ${words}). Acórtalo un poco.`
            : `Your text is over the ${MAX_WORDS}-word limit (you have ${words}). Trim it down a little.`
        },
        { status: 422 },
      );
    }
    if (words < MIN_WORDS) {
      return NextResponse.json(
        { error: isES
            ? `Escribe un poco más (al menos ${MIN_WORDS} palabras) para que el análisis sea útil.`
            : `Write a little more (at least ${MIN_WORDS} words) so the analysis is meaningful.`
        },
        { status: 422 },
      );
    }

    // Owner bypass: unlimited access via secret header or the signed-in owner account.
    if (!(await isOwner(request))) {
      const ipHash = hashIp(getClientIp(request));
      if (!(await checkDbLimit('lens', ipHash, DAILY_LIMIT))) {
        // Structured 429 — the client renders a friendly message, never the raw code.
        return NextResponse.json(
          { error: 'limit_reached', limit: DAILY_LIMIT, resetAt: 'daily' },
          { status: 429 },
        );
      }
    }

    const result = await analyzeWithLens({ text, language });
    if (!result.ok) {
      // AI degraded/busy — friendly 503 the client turns into a retry prompt.
      return NextResponse.json({ error: result.error }, { status: 503 });
    }

    return NextResponse.json({ profile: result.profile, model: result.model }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/lens] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
