// Pure language-plausibility gate for the Empire Lens flow. No I/O, no AI, no
// DB — deterministic and side-effect free so it can be unit tested and run
// BEFORE any AI call (and before the daily quota is spent) in the /api/lens
// route. It mirrors the single-word dictionary gate (resolveDictionaryGate):
// its ONLY job is to reject input that is clearly not readable prose in the
// target language (keyboard mashing, random letter strings, one word repeated)
// so Lens never fabricates a confident writing profile for gibberish.
//
// Guiding bias (same as the dictionary gate): a learner writing bad English or
// Spanish must ALWAYS pass. Every signal below is combined via ratios and tuned
// conservatively so ordinary broken prose is never rejected — only input where
// the MAJORITY of tokens are non-language.

export type LensRejectionReason = 'NOT_LANGUAGE' | 'TOO_SHORT' | 'REPEATED' | 'WRONG_LANGUAGE';

export type ProseValidationResult =
  | { ok: true }
  | { ok: false; reason: LensRejectionReason; message: string };

// Minimum real-looking words for a diagnosis to be meaningful. Below this the
// text is either too short or mostly non-language; either way there's nothing
// honest to analyze.
export const MIN_REAL_WORDS = 3;

// Reject once at least half the tokens are structurally implausible as words —
// a high bar so a stray odd token in real prose never trips it.
const IMPLAUSIBLE_RATIO_LIMIT = 0.5;
// A single token type dominating this share of the text (with enough tokens to
// be sure) is "the same word over and over", not prose.
const REPEAT_RATIO_LIMIT = 0.6;
const REPEAT_MIN_TOKENS = 4;

// Vowels for EN + ES, including accented forms and 'y' (which carries syllables
// in both languages). A token with zero of these is almost never a real word.
const VOWELS = new Set('aeiouyáéíóúýàèìòùâêîôûäëïöüãõ'.split(''));

// Match word tokens: a letter (any script) followed by letters, apostrophes or
// hyphens. Numbers and standalone punctuation are intentionally NOT tokens.
const WORD_RE = /\p{L}[\p{L}'’-]*/gu;

const MESSAGES: Record<LensRejectionReason, { EN: string; ES: string }> = {
  NOT_LANGUAGE: {
    EN: "This doesn’t look like readable writing in English. Paste something you actually wrote — a sentence or two you'd like a second pair of eyes on.",
    ES: 'Esto no parece un texto legible en español. Pega algo que hayas escrito de verdad — una o dos frases a las que quieras darles una mirada.',
  },
  REPEATED: {
    EN: "That’s the same word over and over, so there’s nothing to read into it yet. Paste a few real sentences you wrote and Lens will dig in.",
    ES: 'Es la misma palabra una y otra vez, así que todavía no hay nada que leer ahí. Pega unas frases reales que hayas escrito y Lens las mirará a fondo.',
  },
  TOO_SHORT: {
    EN: 'There isn’t quite enough real writing here yet. Paste a few sentences you actually wrote so the read is meaningful.',
    ES: 'Todavía no hay suficiente texto real aquí. Pega unas frases que hayas escrito de verdad para que la lectura tenga sentido.',
  },
  WRONG_LANGUAGE: {
    EN: 'This looks like it’s in a different language than the one you picked. Switch the language or paste text in English.',
    ES: 'Esto parece estar en un idioma distinto al que elegiste. Cambia el idioma o pega un texto en español.',
  },
};

export function lensRejectionMessage(reason: LensRejectionReason, language: 'EN' | 'ES'): string {
  return MESSAGES[reason][language];
}

// Longest run of consecutive consonants in a token. Real words rarely exceed
// four (English "strengths" hits five); a longer run signals mashing.
function maxConsonantRun(letters: string): number {
  let max = 0;
  let run = 0;
  for (const ch of letters) {
    if (VOWELS.has(ch)) {
      run = 0;
    } else {
      run += 1;
      if (run > max) max = run;
    }
  }
  return max;
}

function isAllCaps(token: string): boolean {
  // Has cased letters and equals its own uppercase form (so it isn't lowercase
  // or Title case). Length is checked by the caller.
  return token !== token.toLowerCase() && token === token.toUpperCase();
}

// A token is "implausible as a word" when it trips one of several independent
// structural signals. Any single hit flags the token; the caller only rejects
// the whole text when a MAJORITY of tokens are implausible.
function isImplausibleToken(token: string): boolean {
  const lower = token.toLowerCase();
  const letters = lower.replace(/[^\p{L}]/gu, '');
  if (letters.length === 0) return true;

  let vowels = 0;
  for (const ch of letters) if (VOWELS.has(ch)) vowels += 1;

  // No vowel at all in a non-trivial token (e.g. "bcdfg", "qwrtp").
  if (letters.length >= 4 && vowels === 0) return true;
  // Unpronounceable consonant pile-up.
  if (maxConsonantRun(letters) >= 5) return true;
  // Long ALL-CAPS blocks are shouting mash, not words — real acronyms are short.
  if (letters.length >= 6 && isAllCaps(token)) return true;
  // Absurdly long single "word" — no natural word runs this long.
  if (letters.length >= 24) return true;

  return false;
}

export function classifyProse(raw: string, language: 'EN' | 'ES'): ProseValidationResult {
  const fail = (reason: LensRejectionReason): ProseValidationResult => ({
    ok: false,
    reason,
    message: MESSAGES[reason][language],
  });

  const tokens = raw.match(WORD_RE) ?? [];

  if (tokens.length === 0) return fail('NOT_LANGUAGE');

  let implausible = 0;
  const freq = new Map<string, number>();
  for (const tok of tokens) {
    if (isImplausibleToken(tok)) implausible += 1;
    const key = tok.toLowerCase();
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }

  const implausibleRatio = implausible / tokens.length;
  const realWords = tokens.length - implausible;
  const dominant = Math.max(...freq.values());
  const dominantRatio = dominant / tokens.length;

  // 1. Mostly non-language tokens → gibberish.
  if (implausibleRatio >= IMPLAUSIBLE_RATIO_LIMIT) return fail('NOT_LANGUAGE');

  // 2. One word repeated to fill space.
  if (tokens.length >= REPEAT_MIN_TOKENS && dominantRatio >= REPEAT_RATIO_LIMIT) {
    return fail('REPEATED');
  }

  // 3. Not enough real writing to say anything honest about.
  if (realWords < MIN_REAL_WORDS) return fail('TOO_SHORT');

  return { ok: true };
}
