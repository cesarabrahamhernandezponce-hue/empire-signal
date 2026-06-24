// ─────────────────────────────────────────────────────────────────────────────
// WORD OF THE DAY — SEED LIST  (curated, B2–C1)
// ─────────────────────────────────────────────────────────────────────────────
// Finalized curated rotation. Edit freely, but keep the rules below intact.
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
  'serendipity',
  'ephemeral',
  'eloquent',
  'resilience',
  'nuance',
  'candid',
  'pragmatic',
  'meticulous',
  'profound',
  'ambiguous',
  'tenacious',
  'lucid',
  'empathy',
  'articulate',
  'inevitable',
];

export const WORDS_ES: readonly string[] = [
  'efímero',
  'resiliencia',
  'inefable',
  'sublime',
  'melancolía',
  'perspicaz',
  'cabal',
  'vehemente',
  'sosiego',
  'ímpetu',
  'añoranza',
  'prudencia',
  'audaz',
  'conmover',
  'esmero',
];
