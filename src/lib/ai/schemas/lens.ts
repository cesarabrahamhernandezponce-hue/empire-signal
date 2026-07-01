import { z } from 'zod';

// Empire Lens diagnostic — a "writing profile" of a pasted text. This is NOT a
// corrected text: the primary payload is insight about the writer (register,
// lexical variety, habits), with word-level suggestions as a secondary layer.
// Arrays are allowed to be empty everywhere — an honest empty array is always
// preferable to a fabricated insight (mirrors the analyze schema's philosophy).
export const lensSchema = z.object({
  // Tolerate the model's most common slip — putting "mixed" (or another stray
  // value) in `level`, conflating it with `consistency`. Rather than discard an
  // otherwise-perfect diagnostic, coerce an out-of-enum level to "neutral" and
  // treat it as a mixed register (an invalid level almost always means the model
  // perceived register mixing). Mirrors the analyze schema's "coerce, don't
  // reject" handling of the phonetic field.
  register: z.preprocess(
    (v) => {
      if (typeof v !== 'object' || v === null) return v;
      const r = v as Record<string, unknown>;
      const valid = ['formal', 'neutral', 'casual', 'technical'];
      if (typeof r.level === 'string' && !valid.includes(r.level)) {
        return { ...r, level: 'neutral', consistency: 'mixed' };
      }
      return v;
    },
    z.object({
      level:       z.enum(['formal', 'neutral', 'casual', 'technical']),
      consistency: z.enum(['consistent', 'mixed']),
      note:        z.string().min(1),
    }),
  ),
  // Clear, unambiguous misspellings only. This is the one place Lens corrects
  // rather than mirrors, so the discipline matters: an honest empty array is the
  // default for clean writing (never flag regional variants, names, or terms).
  spelling: z.array(z.object({
    word:       z.string().min(1),
    correction: z.string().min(1),
  })).min(0).max(10),
  lexicalVariety: z.object({
    assessment: z.string().min(1),
    overused: z.array(z.object({
      word:  z.string().min(1),
      count: z.number().int().min(2),
    })).min(0).max(8),
    crutchWords: z.array(z.string().min(1)).min(0).max(12),
  }),
  patterns: z.array(z.string().min(1)).min(0).max(5),
  spanishSignals: z.array(z.object({
    issue:   z.string().min(1),
    example: z.string().min(1),
    fix:     z.string().min(1),
  })).min(0).max(6),
  wordSuggestions: z.array(z.object({
    word:     z.string().min(1),
    // 0-based index of the flagged occurrence among whitespace-separated tokens.
    // Used as the primary anchor for highlighting; the client falls back to word
    // matching so a slightly-off index never breaks rendering.
    position: z.number().int().min(0),
    alternatives: z.array(z.object({
      word:   z.string().min(1),
      reason: z.string().min(1),
    })).min(1).max(3),
  })).min(0).max(8),
  growthFocus: z.string().min(1),
});

export type LensProfile = z.infer<typeof lensSchema>;

function stripMarkdown(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '');
}

export function parseLens(
  raw: string,
): { ok: true; data: LensProfile } | { ok: false; error: string } {
  const cleaned = stripMarkdown(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: 'The AI response is not valid JSON.' };
  }

  const result = lensSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      ok: false,
      error: `AI response has an invalid structure: ${first.path.join('.') || 'body'} — ${first.message}`,
    };
  }

  return { ok: true, data: result.data };
}
