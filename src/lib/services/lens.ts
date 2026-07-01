import { generateContent } from '../ai/client';
import { buildLensPromptEN } from '../ai/prompts/lens-en';
import { buildLensPromptES } from '../ai/prompts/lens-es';
import type { Language } from '../ai/prompts/types';
import { parseLens, type LensProfile } from '../ai/schemas/lens';

export type LensResult =
  | { ok: true; profile: LensProfile; model: string | null }
  | { ok: false; error: string };

// Diagnoses a pasted text with Empire Lens. Mirrors the analyzeWord pattern:
// reuse the shared AI client, parse strict JSON, and retry ONCE on a parse
// failure (free models occasionally emit malformed JSON on the first pass).
// Deliberately stateless — Lens does not touch the analyze cache or DB; the
// diagnostic is ephemeral and specific to one exact text.
export async function analyzeWithLens(params: {
  text: string;
  language: Language;
}): Promise<LensResult> {
  const { text, language } = params;

  const prompt = language === 'es'
    ? buildLensPromptES(text)
    : buildLensPromptEN(text);

  const aiResult = await generateContent(prompt);
  if (!aiResult.ok) {
    return { ok: false, error: aiResult.error };
  }

  const firstParse = parseLens(aiResult.text);
  if (firstParse.ok) {
    return { ok: true, profile: firstParse.data, model: `${aiResult.provider}:${aiResult.model}` };
  }

  const aiRetry = await generateContent(prompt);
  if (!aiRetry.ok) {
    return { ok: false, error: 'Could not generate a valid writing profile. Please try again.' };
  }
  const secondParse = parseLens(aiRetry.text);
  if (!secondParse.ok) {
    return { ok: false, error: 'Could not generate a valid writing profile. Please try again.' };
  }

  return { ok: true, profile: secondParse.data, model: `${aiRetry.provider}:${aiRetry.model}` };
}
