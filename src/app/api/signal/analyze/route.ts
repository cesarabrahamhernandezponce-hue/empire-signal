import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Language as DbLanguage } from '@prisma/client';

import { analyzeWord, type AnalyzeRecord } from '@/lib/services/signal';
import type { Analysis } from '@/lib/ai/schemas/analysis';
import { generateContent } from '@/lib/ai/client';
import { prisma } from '@/lib/db/prisma';
import { getClientIp, hashIp, checkAnonymousLimit, checkUserLimit } from '@/lib/rate-limit';
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

    const { word: rawWord, context, language } = parsed.data;

    // Normalize: lowercase + strip leading/trailing punctuation so "Hola", "¡hola!" and "hola" hit the same cache entry
    const word = rawWord.toLowerCase().replace(/^[\s!?¡¿.,;:'"()\[\]{}]+|[\s!?¡¿.,;:'"()\[\]{}]+$/g, '');
    if (!word) {
      return NextResponse.json(
        { error: 'Invalid parameters: word — must contain at least one letter.' },
        { status: 400 },
      );
    }

    // Dictionary validation — English only (dictionaryapi.dev has incomplete Spanish coverage)
    if (language === 'en') {
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
          return NextResponse.json({ error: 'Word not found', suggestion }, { status: 422 });
        }
      } catch {
        // timeout or network failure — don't block analysis
      }
    }

    // Owner bypass: unlimited access for the owner via secret header
    const ownerKey = request.headers.get('x-owner-key');
    const bypassKey = process.env.OWNER_BYPASS_KEY;
    const isOwner = Boolean(bypassKey && ownerKey === bypassKey);

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
      prisma.searchRecord.findFirst({ where: { word, language: dbLanguage } })
        .then(r => ({ ok: true as const, value: r }))
        .catch((err) => {
          console.error('[POST /api/signal/analyze] Cache lookup failed:', err);
          return { ok: false as const };
        }),
    ]);

    const userId: string | null = authData?.data?.user?.id ?? null;

    // ok=false (DB error) → prefetched=undefined signals analyzeWord to retry the lookup.
    // ok=true, value=null → confirmed cache miss.
    // ok=true, value=record → cache hit.
    let prefetched: AnalyzeRecord | null | undefined;
    if (cacheResult.ok) {
      const r = cacheResult.value;
      prefetched = r ? {
        id:       r.id,
        word:     r.word,
        context:  r.context,
        language: r.language,
        analysis: r.analysisJson as unknown as Analysis,
        shareId:  r.shareId,
      } : null;
    } else {
      prefetched = undefined;
    }

    // Cache hits are never rate-limited (same as today). Only AI calls count.
    // !undefined and !null are both truthy → rate-limit on cache miss AND on DB uncertainty.
    if (!isOwner && !prefetched) {
      if (userId) {
        const limitResult = await checkUserLimit(userId);
        if (!limitResult.allowed) {
          return NextResponse.json(
            { error: 'limit_reached', tier: 'registered', limit: limitResult.limit, resetAt: 'monthly' },
            { status: 429 },
          );
        }
      } else {
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
        return NextResponse.json({ error: 'Esta palabra no existe en español estándar.', suggestion: null }, { status: 422 });
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
