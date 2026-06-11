import { Language as DbLanguage, Prisma } from '@prisma/client';

import { generateContent } from '../ai/client';
import { buildAnalyzePromptES } from '../ai/prompts/analyze-es';
import { buildAnalyzePromptEN } from '../ai/prompts/analyze-en';
import { buildContextPromptES } from '../ai/prompts/context-es';
import { buildContextPromptEN } from '../ai/prompts/context-en';
import { buildAskPromptES } from '../ai/prompts/ask-es';
import { buildAskPromptEN } from '../ai/prompts/ask-en';
import { buildTranslatePrompt } from '../ai/prompts/translate';
import { parseTranslation } from '../ai/schemas/translation';
import type { Language } from '../ai/prompts/types';
import { parseAnalysis, type Analysis } from '../ai/schemas/analysis';
import { prisma } from '../db/prisma';

const LANGUAGE_MAP: Record<Language, DbLanguage> = {
  es: DbLanguage.ES,
  en: DbLanguage.EN,
};

export type AnalyzeRecord = {
  id: string;
  word: string;
  context: string | null;
  language: DbLanguage;
  analysis: Analysis;
  shareId: string;
};

type ShareRecord = {
  id: string;
  word: string;
  context: string | null;
  language: DbLanguage;
  analysis: Analysis;
  shareId: string;
  createdAt: Date;
};

export type AnalyzeResult =
  | { ok: true; record: AnalyzeRecord; cacheHit: boolean }
  | { ok: false; error: string };

export type ShareResult =
  | { ok: true; record: ShareRecord }
  | { ok: false; error: string; notFound: boolean };

async function enrichWithContext(
  record: AnalyzeRecord,
  word: string,
  context: string | null,
  language: Language,
): Promise<AnalyzeRecord> {
  if (!context || context.length <= 3) return record;
  try {
    const prompt = language === 'es'
      ? buildContextPromptES(word, context)
      : buildContextPromptEN(word, context);
    const result = await generateContent(prompt);
    if (!result.ok) return record;
    const cleaned = result.text.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/\s*```$/, '');
    const raw: unknown = JSON.parse(cleaned);
    const contextNote = (raw as { contextNote?: unknown }).contextNote;
    if (typeof contextNote !== 'string' || contextNote.length === 0) return record;
    return {
      ...record,
      analysis: {
        ...record.analysis,
        essential: { ...record.analysis.essential, contextNote },
      },
    };
  } catch {
    return record;
  }
}

// ── Synonym quality filter ────────────────────────────────────────────────────
// Drops AI synonyms that are hypernyms (parent categories) or that describe
// generic-category concepts. Runs after parsing, before the DB write on cache
// misses (so the filtered version is what gets cached) and before returning on
// cache hits (to clean up records written before this filter existed).
// Extend SYNONYM_HYPERNYMS or GENERIC_NUANCE_RE as new patterns are observed.

const SYNONYM_HYPERNYMS = new Set([
  // Spanish
  'fruta', 'animal', 'cosa', 'objeto', 'planta', 'comida', 'verdura',
  'ser', 'ente', 'elemento', 'sustancia', 'material',
  // English
  'fruit', 'animal', 'thing', 'object', 'plant', 'food', 'being',
  'entity', 'substance', 'material', 'item',
]);

const GENERIC_NUANCE_RE =
  /genérico|engloba|cualquier|categoría|tipo de|generic|any kind of|umbrella term|class of|category of/i;

function filterSynonyms(analysis: Analysis): Analysis {
  const kept = analysis.advanced.synonyms.filter(
    (syn) =>
      !SYNONYM_HYPERNYMS.has(syn.word.toLowerCase()) &&
      !GENERIC_NUANCE_RE.test(syn.nuance),
  );
  if (kept.length === analysis.advanced.synonyms.length) return analysis;
  return { ...analysis, advanced: { ...analysis.advanced, synonyms: kept } };
}

// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeWord(params: {
  word: string;
  context: string | null;
  language: Language;
  userId?: string | null;
  ipHash?: string | null;
  prefetched?: AnalyzeRecord | null;
}): Promise<AnalyzeResult> {
  const { word, language, userId = null, ipHash = null } = params;

  const context = params.context?.trim() || null;
  const dbLanguage = LANGUAGE_MAP[language];

  // Cache key: word + language only — context generates an ephemeral contextNote separately
  let cached: AnalyzeRecord | null = params.prefetched !== undefined ? params.prefetched : null;
  if (params.prefetched === undefined) {
    try {
      const found = await prisma.searchRecord.findFirst({
        where: { word, language: dbLanguage },
      });
      if (found) {
        cached = {
          id:       found.id,
          word:     found.word,
          context:  found.context,
          language: found.language,
          analysis: found.analysisJson as unknown as Analysis,
          shareId:  found.shareId,
        };
      }
    } catch (err) {
      console.error('[analyzeWord] Cache lookup failed:', err);
      // DB unreachable — fall through to AI call rather than blocking the user
    }
  }

  if (cached) {
    prisma.searchEvent.create({
      data: {
        word, context, language: dbLanguage,
        userId, searchRecordId: cached.id, cacheHit: true, ipHash,
      },
    }).catch((err) => console.error('[analyzeWord] SearchEvent (cache hit) failed:', err));

    const record = await enrichWithContext({ ...cached, analysis: filterSynonyms(cached.analysis) }, word, context, language);
    return { ok: true, record, cacheHit: true };
  }

  // Cache miss — base analysis never includes context (it's ephemeral)
  const prompt = language === 'es'
    ? buildAnalyzePromptES(word, null)
    : buildAnalyzePromptEN(word, null);

  const aiResult = await generateContent(prompt);
  if (!aiResult.ok) {
    return { ok: false, error: aiResult.error };
  }

  // Check for word-not-found sentinel before attempting full parse
  const rawCleaned = aiResult.text.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  try {
    const probe = JSON.parse(rawCleaned) as unknown;
    if (typeof probe === 'object' && probe !== null && (probe as Record<string, unknown>).error === 'WORD_NOT_FOUND') {
      return { ok: false, error: 'WORD_NOT_FOUND' };
    }
  } catch { /* not the sentinel — fall through to parseAnalysis */ }

  const firstParse = parseAnalysis(aiResult.text);

  let analysis: Analysis;

  if (firstParse.ok) {
    analysis = firstParse.data;
  } else {
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

  // Filter before DB write so the cached version is already clean
  analysis = filterSynonyms(analysis);

  try {
    const record = await prisma.searchRecord.create({
      data: { word, language: dbLanguage, analysisJson: analysis },
    });

    prisma.searchEvent.create({
      data: {
        word, context, language: dbLanguage,
        userId, searchRecordId: record.id, cacheHit: false, ipHash,
      },
    }).catch((err) => console.error('[analyzeWord] SearchEvent (cache miss) failed:', err));

    const baseRecord: AnalyzeRecord = {
      id:       record.id,
      word:     record.word,
      context:  record.context,
      language: record.language,
      analysis,
      shareId:  record.shareId,
    };
    const enriched = await enrichWithContext(baseRecord, word, context, language);
    return { ok: true, record: enriched, cacheHit: false };
  } catch (err) {
    // Two concurrent requests for the same word+language hit the unique constraint (P2002);
    // recover by returning the record the first request already created.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await prisma.searchRecord.findFirst({
        where: { word, language: dbLanguage },
      });
      if (existing) {
        prisma.searchEvent.create({
          data: {
            word, context, language: dbLanguage,
            userId, searchRecordId: existing.id, cacheHit: false, ipHash,
          },
        }).catch((e) => console.error('[analyzeWord] SearchEvent (concurrent) failed:', e));

        const baseRecord: AnalyzeRecord = {
          id:       existing.id,
          word:     existing.word,
          context:  existing.context,
          language: existing.language,
          analysis: filterSynonyms(existing.analysisJson as unknown as Analysis),
          shareId:  existing.shareId,
        };
        const enriched = await enrichWithContext(baseRecord, word, context, language);
        return { ok: true, record: enriched, cacheHit: false };
      }
    }
    console.error('[analyzeWord] DB write failed:', err);
    // Return the analysis anyway — persistence failed but the user gets a result
    const enriched = await enrichWithContext(
      { id: '', word, context: null, language: dbLanguage, analysis, shareId: '' },
      word, context, language,
    );
    return { ok: true, record: enriched, cacheHit: false };
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
  const firstParse = parseTranslation(aiResult.text, targetLanguages);

  if (firstParse.ok) {
    return { ok: true, translations: firstParse.data };
  }

  const aiRetry = await generateContent(prompt);
  if (!aiRetry.ok) {
    return { ok: false, error: 'Could not generate a valid translation. Please try again.' };
  }
  const secondParse = parseTranslation(aiRetry.text, targetLanguages);
  if (!secondParse.ok) {
    return { ok: false, error: 'Could not generate a valid translation. Please try again.' };
  }

  return { ok: true, translations: secondParse.data };
}

export async function getAnalysisByShareId(shareId: string): Promise<ShareResult> {
  try {
    const found = await prisma.searchRecord.findUnique({ where: { shareId } });

    if (!found) {
      return { ok: false, error: 'Analysis not found.', notFound: true };
    }

    return {
      ok: true,
      record: {
        id:        found.id,
        word:      found.word,
        context:   found.context,
        language:  found.language,
        analysis:  found.analysisJson as unknown as Analysis,
        shareId:   found.shareId,
        createdAt: found.createdAt,
      },
    };
  } catch (err) {
    console.error('[getAnalysisByShareId] DB lookup failed:', err);
    return { ok: false, error: 'Database query failed.', notFound: false };
  }
}
