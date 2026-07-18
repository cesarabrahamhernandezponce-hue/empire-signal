import { generateContent } from '../ai/client';
import { buildLensPromptEN } from '../ai/prompts/lens-en';
import { buildLensPromptES } from '../ai/prompts/lens-es';
import type { Language } from '../ai/prompts/types';
import { parseLens, type LensProfile, type LensRefusalReason } from '../ai/schemas/lens';

export type LensResult =
  | { ok: true; profile: LensProfile; model: string | null }
  // Model-side refusal (Layer 2): the input isn't analyzable prose. Distinct
  // from a technical error so the route can return a friendly 422, not a 503.
  | { ok: false; notAnalyzable: true; reason: LensRefusalReason }
  | { ok: false; notAnalyzable?: false; error: string };

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
  // A refusal is a definitive answer — never retry it (a second call would just
  // spend more budget to reach the same "not analyzable" verdict).
  if (firstParse.ok && !firstParse.analyzable) {
    return { ok: false, notAnalyzable: true, reason: firstParse.reason };
  }
  if (firstParse.ok) {
    return { ok: true, profile: firstParse.profile, model: `${aiResult.provider}:${aiResult.model}` };
  }

  const aiRetry = await generateContent(prompt);
  if (!aiRetry.ok) {
    return { ok: false, error: 'Could not generate a valid writing profile. Please try again.' };
  }
  const secondParse = parseLens(aiRetry.text);
  if (secondParse.ok && !secondParse.analyzable) {
    return { ok: false, notAnalyzable: true, reason: secondParse.reason };
  }
  if (!secondParse.ok) {
    return { ok: false, error: 'Could not generate a valid writing profile. Please try again.' };
  }

  return { ok: true, profile: secondParse.profile, model: `${aiRetry.provider}:${aiRetry.model}` };
}
