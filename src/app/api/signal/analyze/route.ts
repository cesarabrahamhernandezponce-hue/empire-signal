import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Language as DbLanguage } from '@prisma/client';

import { analyzeWord, findCachedByKey, toLookupKey, type AnalyzeRecord } from '@/lib/services/signal';
import { generateContent } from '@/lib/ai/client';
import { prisma } from '@/lib/db/prisma';
import { getClientIp, hashIp, checkAnonymousLimit, checkUserLimit } from '@/lib/rate-limit';
import { isOwnerRequest, readJsonBody } from '@/lib/api-guard';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';

const LANGUAGE_DB: Record<string, DbLanguage> = {
  es: DbLanguage.ES,
  en: DbLanguage.EN,
};

const bodySchema = z.object({
  word:     z.string().min(1).max(40).trim()
              .refine((val) => val.trim().split(/\s+/).length <= 3, {
                message: 'Empire Signal analyzes words and short phrases, not sentences.',
              }),
  context:  z.string().max(2000).nullish().transform((v) => v ?? null),
  language: z.enum(['es', 'en']).default('en'),
  // "Analyze anyway": set by the client after a soft dictionary not-found to
  // skip the (false-negative-prone) dictionary gate and let the AI decide.
  force:    z.boolean().optional().default(false),
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

    const { word: rawWord, context, language, force } = parsed.data;

    // Normalize: lowercase + strip leading/trailing punctuation so "Hola", "¡hola!" and "hola" hit the same cache entry
    const word = rawWord.toLowerCase().replace(/^[\s!?¡¿.,;:'"()\[\]{}]+|[\s!?¡¿.,;:'"()\[\]{}]+$/g, '');
    if (!word) {
      return NextResponse.json(
        { error: 'Invalid parameters: word — must contain at least one letter.' },
        { status: 400 },
      );
    }

    // Dictionary validation — English single words only. dictionaryapi.dev does
    // single-headword lookups, so it 404s on phrasal verbs and 2-3 word phrases
    // (which the app allows) and on its own incomplete coverage. We therefore:
    //   • skip it for multi-word input (phrasal verbs etc.) — let the AI handle it,
    //   • skip it when the user already chose "analyze anyway" (force),
    //   • treat a 404 as a SOFT not-found (suggestion + analyze-anyway), never a
    //     definitive "does not exist" claim, since false negatives are common.
    const isSingleWord = !/\s/.test(word);
    if (language === 'en' && isSingleWord && !force) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const dictRes = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
          { signal: controller.signal },
        );
        clearTimeout(timeoutId);
        if (dictRes.status === 404) {
          let suggestion: string | null = null;
          try {
            // Sanitize the word before inserting into prompt to prevent injection
            const safeWord = JSON.stringify(word).slice(1, -1);
            const suggResult = await generateContent(
              `The English word "${safeWord}" is likely misspelled. What is the correct spelling? Reply with ONLY the correctly spelled word in lowercase, no punctuation, nothing else.`,
              'text/plain',
            );
            if (suggResult.ok) {
              const sugg = suggResult.text.trim().toLowerCase().replace(/[^a-z'\-]/g, '');
              if (sugg && sugg !== word) suggestion = sugg;
            }
          } catch { /* ignore — suggestion stays null */ }
          return NextResponse.json(
            { error: "We couldn't verify this word.", suggestion, canForce: true },
            { status: 422 },
          );
        }
      } catch {
        // timeout or network failure — don't block analysis
      }
    }

    // Owner bypass: unlimited access for the owner via secret header
    const isOwner = isOwnerRequest(request);

    const ipHash = hashIp(getClientIp(request));
    const dbLanguage = LANGUAGE_DB[language];

    // Normalize context the same way analyzeWord does before storing it,
    // so the cache lookup key matches the stored key exactly.
    const normalizedContext = context?.trim() || null;

    // Run auth check and cache lookup in parallel — auth resolves while the DB
    // round-trip happens, so it adds no extra latency on the critical path.
    const [authData, cacheResult] = await Promise.all([
      createSupabaseClient()
        .then(sb => sb?.auth.getUser() ?? null)
        .catch(() => null),
      findCachedByKey(toLookupKey(word), dbLanguage)
        .then(value => ({ ok: true as const, value }))
        .catch((err) => {
          console.error('[POST /api/signal/analyze] Cache lookup failed:', err);
          return { ok: false as const };
        }),
    ]);

    const userId: string | null = authData?.data?.user?.id ?? null;

    // ok=false (DB error) → prefetched=undefined signals analyzeWord to retry the lookup.
    // ok=true, value=null → confirmed cache miss.
    // ok=true, value=record → cache hit (already an AnalyzeRecord).
    const prefetched: AnalyzeRecord | null | undefined = cacheResult.ok ? cacheResult.value : undefined;

    if (!isOwner) {
      if (userId) {
        // Registered users: unchanged — only AI calls (cache misses) count toward
        // the monthly limit; cache hits stay free. (!prefetched is truthy on a
        // cache miss AND on DB uncertainty.)
        if (!prefetched) {
          const limitResult = await checkUserLimit(userId);
          if (!limitResult.allowed) {
            return NextResponse.json(
              { error: 'limit_reached', tier: 'registered', limit: limitResult.limit, resetAt: 'monthly' },
              { status: 429 },
            );
          }
        }
      } else {
        // Anonymous users: EVERY search counts toward the daily limit, including
        // cache hits, to drive signup. The count is recomputed server-side from the
        // DB by IP hash for the current UTC day on every request, so a client
        // refresh or re-searching a now-cached word cannot bypass it.
        const limitResult = await checkAnonymousLimit(ipHash);
        if (!limitResult.allowed) {
          return NextResponse.json(
            { error: 'limit_reached', tier: 'anonymous', limit: limitResult.limit, resetAt: 'daily' },
            { status: 429 },
          );
        }
      }
    }

    const result = await analyzeWord({ word, context: normalizedContext, language, userId, ipHash, prefetched });

    if (!result.ok) {
      if (result.error === 'WORD_NOT_FOUND') {
        // The AI judged the input isn't a standard word — a stronger signal than
        // the dictionary, so no "analyze anyway" here (canForce omitted). Still
        // worded softly and offers a suggestion + the other-language fallback.
        return NextResponse.json(
          {
            error: language === 'es'
              ? 'No pudimos verificar esta palabra como español estándar.'
              : "We couldn't verify this as a standard English word.",
            suggestion: result.suggestion ?? null,
          },
          { status: 422 },
        );
      }
      return NextResponse.json({ error: result.error }, { status: 503 });
    }

    // Fire-and-forget: write user search history for authenticated users.
    // Never blocks or fails the response.
    const userEmail = authData?.data?.user?.email;
    if (result.record.id && userId && userEmail) {
      void (async () => {
        try {
          await prisma.user.upsert({
            where:  { id: userId },
            create: { id: userId, email: userEmail },
            update: {},
          });
          await prisma.userSearchHistory.upsert({
            where:  { userId_searchRecordId: { userId, searchRecordId: result.record.id } },
            create: { userId, searchRecordId: result.record.id },
            update: { viewedAt: new Date() },
          });
        } catch (err) {
          console.error('[POST /api/signal/analyze] History write failed:', err);
        }
      })();
    }

    return NextResponse.json({ record: result.record, cacheHit: result.cacheHit }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/signal/analyze] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
