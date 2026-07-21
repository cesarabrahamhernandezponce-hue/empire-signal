import { z } from 'zod';
import { stripJsonFences } from '../json';

// The context enrichment call returns a single short note explaining the word in
// the user's specific sentence. Validated (not raw-cast) so a malformed or
// oversized payload can't be injected into the displayed analysis. Kept modest:
// this is one sentence of gloss, never persisted.
const contextSchema = z.object({
  contextNote: z.string().min(1).max(600),
});

export function parseContextNote(raw: string): string | null {
  try {
    const parsed = contextSchema.safeParse(JSON.parse(stripJsonFences(raw)));
    return parsed.success ? parsed.data.contextNote : null;
  } catch {
    return null;
  }
}
