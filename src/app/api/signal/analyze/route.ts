import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Tone as DbTone, Language as DbLanguage } from '@prisma/client';

import { analyzeWord, type AnalyzeRecord } from '@/lib/services/signal';
import type { Analysis } from '@/lib/ai/schemas/analysis';
import { generateContent } from '@/lib/ai/client';
import { prisma } from '@/lib/db/prisma';
import { getClientIp, hashIp, checkInMemoryLimit } from '@/lib/rate-limit';

const DAILY_LIMIT = 10;

const TONE_DB: Record<string, DbTone> = {
  practico:  DbTone.PRACTICO,
  academico: DbTone.ACADEMICO,
  creativo:  DbTone.CREATIVO,
  infantil:  DbTone.INFANTIL,
};

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
  tone:     z.enum(['practico', 'academico', 'creativo', 'infantil']).default('practico'),
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

    const { word: rawWord, context, tone, language } = parsed.data;

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
    const dbTone = TONE_DB[tone];
    const dbLanguage = LANGUAGE_DB[language];

    // Normalize context the same way analyzeWord does before storing it,
    // so the cache lookup key matches the stored key exactly.
    const normalizedContext = context?.trim() || null;

    // Always check the cache first — this benefits everyone including the owner.
    // prefetched=undefined signals analyzeWord to do its own lookup (fallback).
    let prefetched: AnalyzeRecord | null | undefined = undefined;
    try {
      const cacheHit = await prisma.searchRecord.findFirst({
        where: { word, context: normalizedContext, tone: dbTone, language: dbLanguage },
      });
      // Set explicitly: null = cache miss confirmed, non-null = hit.
      prefetched = cacheHit ? {
        id:       cacheHit.id,
        word:     cacheHit.word,
        context:  cacheHit.context,
        tone:     cacheHit.tone,
        language: cacheHit.language,
        analysis: cacheHit.analysisJson as unknown as Analysis,
        shareId:  cacheHit.shareId,
      } : null;
    } catch (err) {
      // DB error during cache lookup — leave prefetched=undefined so analyzeWord
      // retries the lookup itself rather than skipping it entirely.
      console.error('[POST /api/signal/analyze] Cache lookup failed:', err);
    }

    if (!isOwner && !prefetched) { // !undefined and !null are both true → rate-limit on uncertainty
      // In-memory check: atomic within this process, eliminates same-process race conditions.
      if (!checkInMemoryLimit(`analyze:${ipHash}`, DAILY_LIMIT)) {
        return NextResponse.json(
          { error: 'Daily limit reached. Come back tomorrow.' },
          { status: 429 },
        );
      }
      // DB check: authoritative across processes/instances.
      const todayUtc = new Date();
      todayUtc.setUTCHours(0, 0, 0, 0);
      const usageCount = await prisma.searchEvent.count({
        where: {
          ipHash,
          cacheHit: false,
          createdAt: { gte: todayUtc },
        },
      });
      if (usageCount >= DAILY_LIMIT) {
        return NextResponse.json(
          { error: 'Daily limit reached. Come back tomorrow.' },
          { status: 429 },
        );
      }
    }

    const result = await analyzeWord({ word, context: normalizedContext, tone, language, userId: null, ipHash, prefetched });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }

    return NextResponse.json({ record: result.record }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/signal/analyze] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
