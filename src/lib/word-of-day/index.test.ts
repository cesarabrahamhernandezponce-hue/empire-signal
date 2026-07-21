import { describe, it, expect } from 'vitest';

import { wordOfDayIndex, wordOfTheDay } from './index';
import { WORDS_EN, WORDS_ES } from './seed';

const EPOCH = new Date('2024-01-01T00:00:00Z');

describe('wordOfDayIndex', () => {
  it('is 0 at the epoch', () => {
    expect(wordOfDayIndex(15, EPOCH)).toBe(0);
  });

  it('advances by one per calendar day', () => {
    const day1 = new Date('2024-01-02T00:00:00Z');
    const day2 = new Date('2024-01-03T00:00:00Z');
    expect(wordOfDayIndex(15, day1)).toBe(1);
    expect(wordOfDayIndex(15, day2)).toBe(2);
  });

  it('wraps with modulo at the end of the list', () => {
    const day15 = new Date('2024-01-16T00:00:00Z'); // 15 days after epoch
    expect(wordOfDayIndex(15, day15)).toBe(0);
  });

  it('does not jump at the year boundary (Dec 31 → Jan 1 advances by one)', () => {
    const dec31 = new Date('2024-12-31T00:00:00Z');
    const jan1 = new Date('2025-01-01T00:00:00Z');
    const diff = (wordOfDayIndex(15, jan1) - wordOfDayIndex(15, dec31) + 15) % 15;
    expect(diff).toBe(1);
  });

  it('stays in range for dates before the epoch', () => {
    const before = new Date('2023-06-15T00:00:00Z');
    const idx = wordOfDayIndex(15, before);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(15);
  });

  it('is timezone-independent (same UTC day → same index regardless of clock time)', () => {
    const morning = new Date('2024-03-10T00:30:00Z');
    const night = new Date('2024-03-10T23:30:00Z');
    expect(wordOfDayIndex(15, morning)).toBe(wordOfDayIndex(15, night));
  });

  it('returns 0 for a non-positive length instead of dividing by zero', () => {
    expect(wordOfDayIndex(0, EPOCH)).toBe(0);
    expect(wordOfDayIndex(-5, EPOCH)).toBe(0);
  });
});

describe('wordOfTheDay', () => {
  it('returns the epoch word for each language', () => {
    expect(wordOfTheDay('en', EPOCH)).toBe(WORDS_EN[0]);
    expect(wordOfTheDay('es', EPOCH)).toBe(WORDS_ES[0]);
  });

  it('rotates each language over its own list independently', () => {
    const day1 = new Date('2024-01-02T00:00:00Z');
    expect(wordOfTheDay('en', day1)).toBe(WORDS_EN[1 % WORDS_EN.length]);
    expect(wordOfTheDay('es', day1)).toBe(WORDS_ES[1 % WORDS_ES.length]);
  });

  it('is deterministic for a given date', () => {
    const d = new Date('2024-07-21T12:00:00Z');
    expect(wordOfTheDay('en', d)).toBe(wordOfTheDay('en', d));
  });
});
