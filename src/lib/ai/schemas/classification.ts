import { z } from 'zod';

// Ephemeral lexical classification used ONLY to route a dictionaryapi 404:
// decide whether an unknown token is a real word to analyze, an obvious typo,
// or gibberish. NEVER persisted (like contextNote).
export const classificationSchema = z.object({
  status: z.enum(['valid', 'misspelling', 'not_a_word']),
  // Only meaningful when status === 'misspelling'.
  suggestion: z.string().nullish().transform((v) => v ?? null),
  category: z
    .enum(['slang', 'acronym', 'neologism', 'proper_noun', 'regional', 'technical', 'standard'])
    .nullish()
    .transform((v) => v ?? null),
});

export type Classification = z.infer<typeof classificationSchema>;

function stripMarkdown(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '');
}

export function parseClassification(
  raw: string,
): { ok: true; data: Classification } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdown(raw));
  } catch {
    return { ok: false, error: 'AI classification was not valid JSON.' };
  }
  const result = classificationSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, error: `Invalid classification shape: ${first.path.join('.') || 'body'} — ${first.message}` };
  }
  return { ok: true, data: result.data };
}
