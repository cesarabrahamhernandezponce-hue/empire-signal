import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { z } from 'zod';
import { Tone as DbTone, Language as DbLanguage } from '@prisma/client';

import { analyzeWord, type AnalyzeRecord } from '@/lib/services/signal';
import type { Analysis } from '@/lib/ai/schemas/analysis';
import { prisma } from '@/lib/db/prisma';

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

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

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

    const { word, context, tone, language } = parsed.data;

    // Owner bypass: unlimited access for the owner via secret header
    const ownerKey = request.headers.get('x-owner-key');
    const bypassKey = process.env.OWNER_BYPASS_KEY;
    const isOwner = Boolean(bypassKey && ownerKey === bypassKey);

    const ipHash = hashIp(getClientIp(request));

    let prefetched: AnalyzeRecord | null = null;

    if (!isOwner) {
      // Cache hits don't count against the limit. Check cache first.
      const dbTone     = TONE_DB[tone];
      const dbLanguage = LANGUAGE_DB[language];

      const found = await prisma.searchRecord.findFirst({
        where: { word, context: context ?? null, tone: dbTone, language: dbLanguage },
      });

      if (found) {
        prefetched = {
          id:       found.id,
          word:     found.word,
          context:  found.context,
          tone:     found.tone,
          language: found.language,
          analysis: found.analysisJson as unknown as Analysis,
          shareId:  found.shareId,
        };
      } else {
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
    }

    const result = await analyzeWord({ word, context, tone, language, userId: null, ipHash, prefetched });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json({ record: result.record }, { status: 200 });
  } catch (err) {
    console.error('[POST /api/signal/analyze] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
