// ─────────────────────────────────────────────────────────────────────────────
// WORD OF THE DAY — SEED LIST  ⚠️ PLACEHOLDER — REVIEW BEFORE LAUNCH ⚠️
// ─────────────────────────────────────────────────────────────────────────────
// César: these are reasonable candidates, NOT a final curated list. Edit freely.
// Rules to keep things working:
//   • Exactly 15 words per language (the daily rotation is `days % list.length`).
//     If you change the count, both lists can differ in length — each language
//     rotates over its own list independently.
//   • One word (or short phrase) per entry, lowercase, in its canonical spelling
//     WITH accents for ES (the cache lookup is accent-insensitive, so "ímpetu"
//     and "impetu" resolve to the same record either way).
//   • After ANY edit here, re-run the pre-generation script so every word is a
//     guaranteed cache hit:  node --env-file=.env.local scripts/precache/word-of-day.ts
// Target audience: intermediate–advanced learners — interesting/useful words,
// not too basic, not so obscure they're useless.
// ─────────────────────────────────────────────────────────────────────────────

export const WORDS_EN: readonly string[] = [
  'ephemeral',
  'serendipity',
  'nuance',
  'resilience',
  'ubiquitous',
  'eloquent',
  'meticulous',
  'candor',
  'tenacious',
  'ambivalent',
  'pragmatic',
  'scrutinize',
  'juxtapose',
  'cathartic',
  'quintessential',
];

export const WORDS_ES: readonly string[] = [
  'efímero',
  'resiliencia',
  'inefable',
  'cotidiano',
  'perspicaz',
  'añoranza',
  'matiz',
  'ímpetu',
  'sosegado',
  'vislumbrar',
  'arraigar',
  'desdén',
  'conmover',
  'esmero',
  'vorágine',
];
