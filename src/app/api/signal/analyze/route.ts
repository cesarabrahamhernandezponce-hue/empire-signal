import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Language as DbLanguage } from '@prisma/client';

import { analyzeWord, findCachedByKey, toLookupKey, type AnalyzeRecord } from '@/lib/services/signal';
import { resolveDictionaryGate } from '@/lib/services/word-classifier';
import { prisma } from '@/lib/db/prisma';
import { getClientIp, hashIp, checkAnonymousLimit, checkUserLimit } from '@/lib/rate-limit';
import { isOwnerRequest, readJsonBody } from '@/lib/api-guard';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';
import { classifyInput } from '@/lib/validation/input';

const LANGUAGE_DB: Record<string, DbLanguage> = {
  es: DbLanguage.ES,
  en: DbLanguage.EN,
};

const bodySchema = z.object({
  // Shape only — content rules (length, word count, non-text, etc.) live in the
  // pure validation layer (classifyInput) so they're testable and run first.
  word:     z.string().min(1),
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

    // Pure validation + normalization gate — runs before any AI/DB call.
    const validation = classifyInput(rawWord, language === 'es' ? 'ES' : 'EN');
    if (!validation.ok) {
      // `error` mirrors `message` for backward-compatibility with the existing
      // client, which reads `data.error` on non-ok responses.
      return NextResponse.json(
        { reason: validation.reason, message: validation.message, error: validation.message },
        { status: 400 },
      );
    }
    const word = validation.normalized;

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

    // Dictionary gate — runs ONLY on a confirmed cache MISS (prefetched === null),
    // so cached words never hit dictionaryapi or the classifier. On a cache HIT
    // (record) or a DB error (undefined) we skip it. On a 404 the classifier
    // decides: real-but-uncommon words (slang/acronyms/neologisms/proper nouns)
    // proceed to analysis; only clear typos and gibberish are rejected. This is
    // ordered before rate limiting, matching the prior dictionary-check position.
    if (prefetched === null) {
      const gate = await resolveDictionaryGate({ word, language, force });
      if (!gate.ok) {
        const isES = language === 'es';
        const error = gate.reason === 'not_a_word'
          ? (isES ? 'No reconocemos esta palabra.' : "This doesn't look like a recognized word.")
          : (isES ? 'No pudimos verificar esta palabra.' : "We couldn't verify this word.");
        // canForce keeps the "analyze anyway" escape hatch: the dictionary and
        // classifier can both be wrong, so we never hard-block.
        return NextResponse.json(
          { error, suggestion: gate.suggestion, canForce: true },
          { status: 422 },
        );
      }
    }

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
