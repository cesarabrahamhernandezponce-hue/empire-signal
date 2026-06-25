import { z } from 'zod';

export const analysisSchema = z.object({
  version: z.literal(1),
  // Canonical spelling returned by the AI (diacritics/ñ restored). Optional so
  // records cached before this field existed still parse.
  word: z.string().min(1).optional(),
  // Set by the service (never the AI) when the canonical word differs from what
  // the user typed, e.g. input "anonimo" → correctedFrom "anonimo", word "anónimo".
  correctedFrom: z.string().min(1).optional(),
  essential: z.object({
    meaningInContext: z.string().min(1),
    wordType: z.object({
      category:    z.string().min(1),
      explanation: z.string().min(1),
    }),
    // Every common part of speech the word has, ordered by usage frequency.
    // Optional for backward compatibility: records cached before this field
    // existed carry only `wordType`. New records carry both (wordType = the
    // primary/most-frequent POS, mirrored as wordTypes[0]).
    wordTypes: z.array(z.object({
      category:    z.string().min(1),
      explanation: z.string().min(1),
    })).min(1).max(4).optional(),
    pronunciation: z.object({
      // Free models sometimes hallucinate long IPA/prose here. Truncating a single
      // cosmetic field is far better than failing validation and discarding an
      // otherwise-correct analysis, so coerce overlong values down to the cap.
      phonetic: z.preprocess(
        (v) => (typeof v === 'string' ? v.trim().slice(0, 45) : v),
        z.string().max(45),
      ),
      guide:    z.string().min(1),
    }),
    usageExamples: z.array(
      z.object({
        register: z.string().min(1),
        example:  z.string().min(1),
      }),
    ).length(3),
    collocations: z.array(
      z.object({
        phrase:  z.string().min(1),
        meaning: z.string().min(1),
      }),
    ).min(3).max(6),
    cefr: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
    contextNote: z.string().optional(),
    meanings: z.array(z.object({
      definition:  z.string().min(1),
      partOfSpeech: z.string().min(1),
      example:     z.string().optional(),
    })).min(0).optional(),
  }),
  advanced: z.object({
    etymology: z.string(),
    story:     z.string(),
    synonyms: z.array(
      z.object({
        word:   z.string().min(1),
        nuance: z.string().min(1),
      }),
    ).min(0).max(6),
    antonyms: z.array(
      z.object({
        word:    z.string().min(1),
        context: z.string().min(1),
      }),
    ).min(0).max(6),
    registerLevel: z.object({
      level:    z.string().min(1),
      guidance: z.string().min(1),
    }),
    commonErrors: z.array(
      z.object({
        error:      z.string().min(1),
        correction: z.string().min(1),
      }),
    ).min(0).max(3),
    wordFamily: z.array(
      z.object({
        word:     z.string().min(1),
        relation: z.string().min(1),
      }),
    ).min(0).max(6),
  }),
});

export type Analysis = z.infer<typeof analysisSchema>;

export type WordTypeEntry = { category: string; explanation: string };

// Read-side bridge between old and new records: prefer the multi-POS `wordTypes`
// array, falling back to the single legacy `wordType` so cached records keep
// rendering. Always returns a non-empty array.
export function resolveWordTypes(essential: Analysis['essential']): WordTypeEntry[] {
  return essential.wordTypes ?? [essential.wordType];
}

export function parseAnalysis(raw: string): { ok: true; data: Analysis } | { ok: false; error: string } {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: 'La respuesta de la IA no es JSON válido.' };
  }

  const result = analysisSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      ok: false,
      error: `Respuesta de IA con estructura inválida: ${first.path.join('.')} — ${first.message}`,
    };
  }

  return { ok: true, data: result.data };
}
