import { z } from 'zod';

export const analysisSchema = z.object({
  version: z.literal(1),
  essential: z.object({
    meaningInContext: z.string().min(1),
    wordType: z.object({
      category:    z.string().min(1),
      explanation: z.string().min(1),
    }),
    pronunciation: z.object({
      phonetic: z.string().max(45),
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
    })).min(1).optional(),
  }),
  advanced: z.object({
    etymology: z.string(),
    story:     z.string(),
    synonyms: z.array(
      z.object({
        word:   z.string().min(1),
        nuance: z.string().min(1),
      }),
    ).min(1).max(6),
    antonyms: z.array(
      z.object({
        word:    z.string().min(1),
        context: z.string().min(1),
      }),
    ).max(6),
    registerLevel: z.object({
      level:    z.string().min(1),
      guidance: z.string().min(1),
    }),
    commonErrors: z.array(
      z.object({
        error:      z.string().min(1),
        correction: z.string().min(1),
      }),
    ).min(1).max(3),
    wordFamily: z.array(
      z.object({
        word:     z.string().min(1),
        relation: z.string().min(1),
      }),
    ).min(1).max(6),
  }),
});

export type Analysis = z.infer<typeof analysisSchema>;

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
