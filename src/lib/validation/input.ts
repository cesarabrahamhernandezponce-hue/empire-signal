// Pure input-validation layer for the analyze flow. No I/O, no AI, no DB —
// every function here is deterministic and side-effect free so it can be unit
// tested in isolation and run BEFORE any AI/DB call in the analyze route.

export type ValidationReason =
  | 'EMPTY'
  | 'NO_LETTERS'
  | 'NUMERIC_ONLY'
  | 'NON_TEXT'
  | 'TOO_LONG'
  | 'TOO_MANY_WORDS'
  | 'URL_OR_EMAIL'
  | 'MARKUP';

export type ValidationResult =
  | { ok: true; normalized: string; wordCount: number }
  | { ok: false; reason: ValidationReason; message: string };

export const MAX_LENGTH = 40;
// Raised from 3 to 5: phrasal-prepositional verbs and short idioms such as
// "look forward to" or "kick the bucket" are legitimate lookups.
export const MAX_WORDS = 5;

// Short, user-facing copy in the analysis language.
const MESSAGES: Record<ValidationReason, { EN: string; ES: string }> = {
  EMPTY: {
    EN: 'Type a word to analyze.',
    ES: 'Escribe una palabra para analizar.',
  },
  NO_LETTERS: {
    EN: 'Enter a word with at least one letter.',
    ES: 'Introduce una palabra con al menos una letra.',
  },
  NUMERIC_ONLY: {
    EN: 'Numbers can’t be analyzed — enter a word.',
    ES: 'No se pueden analizar números — introduce una palabra.',
  },
  NON_TEXT: {
    EN: 'Emoji and symbols can’t be analyzed — enter a word.',
    ES: 'No se pueden analizar emojis ni símbolos — introduce una palabra.',
  },
  TOO_LONG: {
    EN: `That’s too long — keep it under ${MAX_LENGTH} characters.`,
    ES: `Es demasiado largo — usa menos de ${MAX_LENGTH} caracteres.`,
  },
  TOO_MANY_WORDS: {
    EN: `Analyze words and short phrases, not sentences (up to ${MAX_WORDS} words).`,
    ES: `Analiza palabras y frases cortas, no oraciones (hasta ${MAX_WORDS} palabras).`,
  },
  URL_OR_EMAIL: {
    EN: 'Enter a word, not a link or email address.',
    ES: 'Introduce una palabra, no un enlace ni un correo.',
  },
  MARKUP: {
    EN: 'Enter a plain word, not code or markup.',
    ES: 'Introduce una palabra normal, no código ni etiquetas.',
  },
};

// Strip punctuation only from the OUTER edges, preserving internal apostrophes
// and hyphens ("don't", "o'clock", "mother-in-law") and all diacritics
// ("canción", "él"). \p{L}\p{N} keeps any letter (any script) or number.
const LEADING_EDGE = /^[^\p{L}\p{N}]+/u;
const TRAILING_EDGE = /[^\p{L}\p{N}]+$/u;

export function normalizeWord(raw: string, language: 'EN' | 'ES'): string {
  // language is part of the contract for future language-specific rules; both
  // languages currently preserve diacritics, so it isn't branched on yet.
  void language;
  const collapsed = raw.trim().replace(/\s+/g, ' ');
  const trimmedEdges = collapsed.replace(LEADING_EDGE, '').replace(TRAILING_EDGE, '');
  // TODO(cache-key): lowercasing here also feeds the (word, language) cache key.
  // Capitalization/diacritic/lemmatization handling in the key is out of scope
  // for this task; revisit when the cache key is the subject.
  return trimmedEdges.toLowerCase();
}

const URL_RE = /(https?:\/\/|www\.)/i;
const EMAIL_RE = /\S+@\S+\.\S+/;
const TAG_RE = /<[^>]*>/;
// Conservative SQL shape: a DML/DDL keyword paired with a clause keyword. Avoids
// flagging ordinary phrases that merely contain one such word.
const SQL_RE = /\b(select|insert|update|delete|drop|union|alter|create)\b[\s\S]*\b(from|into|table|where|values|set)\b/i;
const EMOJI_RE = /\p{Extended_Pictographic}/u;
// Digits with optional decimal/thousand separators and whitespace, nothing else.
const NUMERIC_RE = /^[\d.,\s]+$/;

export function classifyInput(raw: string, language: 'EN' | 'ES'): ValidationResult {
  const fail = (reason: ValidationReason): ValidationResult => ({
    ok: false,
    reason,
    message: MESSAGES[reason][language],
  });

  const trimmed = raw.trim();
  if (trimmed === '') return fail('EMPTY');

  // Links and emails first — they contain letters and would otherwise pass.
  if (URL_RE.test(trimmed) || EMAIL_RE.test(trimmed)) return fail('URL_OR_EMAIL');

  // Markup / code before letter checks, for the same reason.
  if (TAG_RE.test(trimmed) || SQL_RE.test(trimmed)) return fail('MARKUP');

  // Emoji / pictographic characters have no letters either; catch them first so
  // they report NON_TEXT rather than NO_LETTERS.
  if (EMOJI_RE.test(trimmed)) return fail('NON_TEXT');

  // Numeric-only is a deliberate policy: pure numbers ("123", "3.14") are not
  // dictionary headwords, so we reject them rather than send them to the AI.
  if (NUMERIC_RE.test(trimmed) && /\d/.test(trimmed)) return fail('NUMERIC_ONLY');

  // Anything left with no letter in any script is unanalyzable punctuation.
  if (!/\p{L}/u.test(trimmed)) return fail('NO_LETTERS');

  const normalized = normalizeWord(raw, language);
  // Edge-stripping can empty out a string that only had letters at the edges of
  // punctuation runs; treat that as NO_LETTERS too.
  if (normalized === '') return fail('NO_LETTERS');

  if (normalized.length > MAX_LENGTH) return fail('TOO_LONG');

  // A hyphenated compound ("mother-in-law") is a single token: we split on
  // whitespace only.
  const wordCount = normalized.split(' ').filter(Boolean).length;
  if (wordCount > MAX_WORDS) return fail('TOO_MANY_WORDS');

  return { ok: true, normalized, wordCount };
}
