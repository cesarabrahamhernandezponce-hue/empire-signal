import { WORDS_EN, WORDS_ES } from './seed';

export type WodLanguage = 'en' | 'es';

// Fixed epoch (UTC midnight) the rotation counts from. Anchoring to a constant
// date — instead of day-of-year — means the cycle never jumps at a year
// boundary (Dec 31 → Jan 1 advances by exactly one, not back to index 0).
const EPOCH_UTC_MS = Date.UTC(2024, 0, 1); // 2024-01-01T00:00:00Z

// Whole days between `date` and the epoch, measured in UTC so every user on
// Earth sees the same word for the same calendar day regardless of timezone.
function daysSinceEpoch(date: Date): number {
  const todayUtcMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((todayUtcMs - EPOCH_UTC_MS) / 86_400_000);
}

// Deterministic index into a list of the given length for a given date.
// `((n % len) + len) % len` keeps it correct for dates before the epoch too.
export function wordOfDayIndex(length: number, date: Date = new Date()): number {
  if (length <= 0) return 0;
  const days = daysSinceEpoch(date);
  return ((days % length) + length) % length;
}

// The single word shown for `date` in the given language. Pure and side-effect
// free: no DB, no cron, no AI — the same input always yields the same word, so
// it can be computed identically at request time on the server or anywhere else.
export function wordOfTheDay(language: WodLanguage, date: Date = new Date()): string {
  const list = language === 'es' ? WORDS_ES : WORDS_EN;
  return list[wordOfDayIndex(list.length, date)];
}
