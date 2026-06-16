import { generateContent } from '../ai/client';
import { buildClassifyPromptEN } from '../ai/prompts/classify-en';
import { parseClassification, type Classification } from '../ai/schemas/classification';

const DICT_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const DICT_TIMEOUT_MS = 3000;

// On ANY classifier failure (AI down, timeout, malformed JSON) we bias to
// proceed: never block a user on a classifier hiccup.
const FALLBACK_VALID: Classification = { status: 'valid', suggestion: null, category: null };

// Classify a single unknown English token. Always resolves — never throws and
// never blocks: failures degrade to 'valid'. EPHEMERAL: the result is never
// persisted.
export async function classifyWord(word: string): Promise<Classification> {
  let aiResult;
  try {
    aiResult = await generateContent(buildClassifyPromptEN(word));
  } catch {
    return FALLBACK_VALID;
  }
  if (!aiResult.ok) return FALLBACK_VALID;

  const parsed = parseClassification(aiResult.text);
  if (!parsed.ok) return FALLBACK_VALID;
  return parsed.data;
}

export type DictionaryGateResult =
  | { ok: true }
  | { ok: false; reason: 'misspelling' | 'not_a_word'; suggestion: string | null };

// Clean an AI-suggested correction: keep it only if it's a plausible single
// word that actually differs from the input.
function cleanSuggestion(raw: string | null, word: string): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s || s === word) return null;
  if (!/^[a-z][a-z'-]*$/.test(s)) return null;
  return s;
}

// Decide whether an English single word that the dictionary doesn't list should
// still be analyzed. The caller MUST only invoke this on a confirmed cache miss.
//
// Graceful degradation (unchanged from before): a dictionary timeout / network
// failure, a non-404 status, or any classifier failure all resolve to { ok:true }
// so the user is never blocked by an infra hiccup.
export async function resolveDictionaryGate(params: {
  word: string;
  language: 'es' | 'en';
  force: boolean;
}): Promise<DictionaryGateResult> {
  const { word, language, force } = params;

  // dictionaryapi.dev only does single-headword English lookups, so we skip it
  // for non-English, multi-word phrases (phrasal verbs/idioms), and when the
  // user already chose "analyze anyway".
  const isSingleWord = !/\s/.test(word);
  if (language !== 'en' || !isSingleWord || force) return { ok: true };

  let is404 = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DICT_TIMEOUT_MS);
    const dictRes = await fetch(`${DICT_URL}/${encodeURIComponent(word)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    is404 = dictRes.status === 404;
  } catch {
    // timeout or network failure — proceed without validation
    return { ok: true };
  }

  // Found (200) or any other status — proceed, no classification call.
  if (!is404) return { ok: true };

  const classification = await classifyWord(word);
  switch (classification.status) {
    case 'misspelling':
      return { ok: false, reason: 'misspelling', suggestion: cleanSuggestion(classification.suggestion, word) };
    case 'not_a_word':
      return { ok: false, reason: 'not_a_word', suggestion: null };
    case 'valid':
    default:
      return { ok: true };
  }
}
