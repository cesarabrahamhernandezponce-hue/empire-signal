import { Tone as DbTone, Language as DbLanguage } from '@prisma/client';

import { generateContent } from '../ai/client';
import { buildAnalyzePromptES } from '../ai/prompts/analyze-es';
import { buildAnalyzePromptEN } from '../ai/prompts/analyze-en';
import { buildAskPromptES } from '../ai/prompts/ask-es';
import { buildAskPromptEN } from '../ai/prompts/ask-en';
import { buildTranslatePrompt } from '../ai/prompts/translate';
import { parseTranslation } from '../ai/schemas/translation';
import type { Tone, Language } from '../ai/prompts/types';
import { parseAnalysis, type Analysis } from '../ai/schemas/analysis';
import { prisma } from '../db/prisma';

const TONE_MAP: Record<Tone, DbTone> = {
  practico:  DbTone.PRACTICO,
  academico: DbTone.ACADEMICO,
  creativo:  DbTone.CREATIVO,
  infantil:  DbTone.INFANTIL,
};

const LANGUAGE_MAP: Record<Language, DbLanguage> = {
  es: DbLanguage.ES,
  en: DbLanguage.EN,
};

export type AnalyzeRecord = {
  id: string;
  word: string;
  context: string | null;
  tone: DbTone;
  language: DbLanguage;
  analysis: Analysis;
  shareId: string;
};

type ShareRecord = {
  id: string;
  word: string;
  context: string | null;
  tone: DbTone;
  language: DbLanguage;
  analysis: Analysis;
  shareId: string;
  createdAt: Date;
};

export type AnalyzeResult =
  | { ok: true; record: AnalyzeRecord }
  | { ok: false; error: string };

export type ShareResult =
  | { ok: true; record: ShareRecord }
  | { ok: false; error: string };

export async function analyzeWord(params: {
  word: string;
  context: string | null;
  tone: Tone;
  language: Language;
  userId?: string | null;
  ipHash?: string | null;
  prefetched?: AnalyzeRecord | null;
}): Promise<AnalyzeResult> {
  const { word, tone, language, userId = null, ipHash = null } = params;

  const context = params.context?.trim() || null;
  const dbTone = TONE_MAP[tone];
  const dbLanguage = LANGUAGE_MAP[language];

  // Check cache — skip DB lookup if caller already verified (prefetched !== undefined)
  let cached: AnalyzeRecord | null = params.prefetched !== undefined ? params.prefetched : null;
  if (params.prefetched === undefined) {
    try {
      const found = await prisma.searchRecord.findFirst({
        where: { word, context, tone: dbTone, language: dbLanguage },
      });
      if (found) {
        cached = {
          id:       found.id,
          word:     found.word,
          context:  found.context,
          tone:     found.tone,
          language: found.language,
          analysis: found.analysisJson as unknown as Analysis,
          shareId:  found.shareId,
        };
      }
    } catch (err) {
      console.error('[analyzeWord] Cache lookup failed:', err);
      return { ok: false, error: 'Database query failed.' };
    }
  }

  if (cached) {
    // Fire-and-forget event (telemetry, non-critical)
    prisma.searchEvent.create({
      data: {
        word, context, tone: dbTone, language: dbLanguage,
        userId, searchRecordId: cached.id, cacheHit: true, ipHash,
      },
    }).catch((err) => console.error('[analyzeWord] SearchEvent (cache hit) failed:', err));

    return { ok: true, record: cached };
  }

  // Cache miss — call AI
  const prompt = language === 'es'
    ? buildAnalyzePromptES(word, context, tone)
    : buildAnalyzePromptEN(word, context, tone);

  // First attempt
  const aiResult = await generateContent(prompt);
  if (!aiResult.ok) {
    return { ok: false, error: aiResult.error };
  }
  const firstParse = parseAnalysis(aiResult.text);

  let analysis: Analysis;

  if (firstParse.ok) {
    analysis = firstParse.data;
  } else {
    // Retry once on parse failure
    const aiRetry = await generateContent(prompt);
    if (!aiRetry.ok) {
      return { ok: false, error: 'Could not generate a valid analysis. Please try again.' };
    }
    const secondParse = parseAnalysis(aiRetry.text);
    if (!secondParse.ok) {
      return { ok: false, error: 'Could not generate a valid analysis. Please try again.' };
    }
    analysis = secondParse.data;
  }

  // Persist
  try {
    const record = await prisma.searchRecord.create({
      data: {
        word, context, tone: dbTone, language: dbLanguage,
        analysisJson: analysis,
      },
    });

    // Fire-and-forget event (telemetry, non-critical)
    prisma.searchEvent.create({
      data: {
        word, context, tone: dbTone, language: dbLanguage,
        userId, searchRecordId: record.id, cacheHit: false, ipHash,
      },
    }).catch((err) => console.error('[analyzeWord] SearchEvent (cache miss) failed:', err));

    return {
      ok: true,
      record: {
        id:       record.id,
        word:     record.word,
        context:  record.context,
        tone:     record.tone,
        language: record.language,
        analysis,
        shareId:  record.shareId,
      },
    };
  } catch (err) {
    console.error('[analyzeWord] DB write failed:', err);
    return { ok: false, error: 'Failed to save the analysis.' };
  }
}

export async function askFollowUp(params: {
  word: string;
  context: string | null;
  question: string;
  language: Language;
  searchRecordId: string;
  userId?: string | null;
}): Promise<{ ok: true; answer: string } | { ok: false; error: string }> {
  const { word, question, language, searchRecordId, userId = null } = params;
  const context = params.context?.trim() || null;

  const prompt = language === 'es'
    ? buildAskPromptES(word, context, question)
    : buildAskPromptEN(word, context, question);

  const aiResult = await generateContent(prompt, 'text/plain');
  if (!aiResult.ok) {
    return { ok: false, error: aiResult.error };
  }

  const answer = aiResult.text.trim();

  try {
    await prisma.followUpQuestion.create({
      data: { searchRecordId, userId, question, answer },
    });
  } catch (err) {
    console.error('[askFollowUp] DB save failed:', err);
  }

  return { ok: true, answer };
}

export async function translateWord(params: {
  word: string;
  targetLanguages: string[];
  tone?: string;
}): Promise<{ ok: true; translations: Record<string, string> } | { ok: false; error: string }> {
  const { word, targetLanguages, tone = 'neutral' } = params;

  if (targetLanguages.length === 0) {
    return { ok: false, error: 'At least one target language is required.' };
  }

  const prompt = buildTranslatePrompt(word, targetLanguages, tone);

  const aiResult = await generateContent(prompt);
  if (!aiResult.ok) {
    return { ok: false, error: aiResult.error };
  }
  const firstParse = parseTranslation(aiResult.text);

  if (firstParse.ok) {
    return { ok: true, translations: firstParse.data };
  }

  // Retry once on parse failure
  const aiRetry = await generateContent(prompt);
  if (!aiRetry.ok) {
    return { ok: false, error: 'Could not generate a valid translation. Please try again.' };
  }
  const secondParse = parseTranslation(aiRetry.text);
  if (!secondParse.ok) {
    return { ok: false, error: 'Could not generate a valid translation. Please try again.' };
  }

  return { ok: true, translations: secondParse.data };
}

export async function getAnalysisByShareId(shareId: string): Promise<ShareResult> {
  try {
    const found = await prisma.searchRecord.findUnique({ where: { shareId } });

    if (!found) {
      return { ok: false, error: 'Analysis not found.' };
    }

    return {
      ok: true,
      record: {
        id:        found.id,
        word:      found.word,
        context:   found.context,
        tone:      found.tone,
        language:  found.language,
        analysis:  found.analysisJson as unknown as Analysis,
        shareId:   found.shareId,
        createdAt: found.createdAt,
      },
    };
  } catch (err) {
    console.error('[getAnalysisByShareId] DB lookup failed:', err);
    return { ok: false, error: 'Database query failed.' };
  }
}
