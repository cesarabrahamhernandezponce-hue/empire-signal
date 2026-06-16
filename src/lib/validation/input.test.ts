import { describe, it, expect } from 'vitest';

import { classifyInput, normalizeWord, MAX_LENGTH, MAX_WORDS } from './input';

describe('classifyInput — rejections', () => {
  it('EMPTY for empty string', () => {
    const r = classifyInput('', 'EN');
    expect(r).toMatchObject({ ok: false, reason: 'EMPTY' });
  });

  it('EMPTY for whitespace-only', () => {
    const r = classifyInput('   ', 'EN');
    expect(r).toMatchObject({ ok: false, reason: 'EMPTY' });
  });

  it.each(['¡!', '...', '@#$'])('NO_LETTERS for %j', (input) => {
    expect(classifyInput(input, 'EN')).toMatchObject({ ok: false, reason: 'NO_LETTERS' });
  });

  it.each(['123', '3.14', '3,14', '1 000'])('NUMERIC_ONLY for %j', (input) => {
    expect(classifyInput(input, 'EN')).toMatchObject({ ok: false, reason: 'NUMERIC_ONLY' });
  });

  it('NON_TEXT for emoji', () => {
    expect(classifyInput('😀', 'EN')).toMatchObject({ ok: false, reason: 'NON_TEXT' });
  });

  it('TOO_LONG for a 41-char string', () => {
    const input = 'a'.repeat(MAX_LENGTH + 1);
    expect(classifyInput(input, 'EN')).toMatchObject({ ok: false, reason: 'TOO_LONG' });
  });

  it('allows exactly MAX_LENGTH chars', () => {
    const input = 'a'.repeat(MAX_LENGTH);
    expect(classifyInput(input, 'EN')).toMatchObject({ ok: true });
  });

  it('TOO_MANY_WORDS for 6 words', () => {
    expect(classifyInput('a b c d e f', 'EN')).toMatchObject({ ok: false, reason: 'TOO_MANY_WORDS' });
  });

  it('allows exactly MAX_WORDS words', () => {
    const input = Array.from({ length: MAX_WORDS }, (_, i) => `w${i}`).join(' ');
    expect(classifyInput(input, 'EN')).toMatchObject({ ok: true, wordCount: MAX_WORDS });
  });

  it.each(['http://x.com', 'https://example.com/path', 'www.example.com'])(
    'URL_OR_EMAIL for %j',
    (input) => {
      expect(classifyInput(input, 'EN')).toMatchObject({ ok: false, reason: 'URL_OR_EMAIL' });
    },
  );

  it('URL_OR_EMAIL for an email', () => {
    expect(classifyInput('user@mail.com', 'EN')).toMatchObject({ ok: false, reason: 'URL_OR_EMAIL' });
  });

  it.each(['<script>alert(1)</script>', '<b>hi</b>'])('MARKUP for %j', (input) => {
    expect(classifyInput(input, 'EN')).toMatchObject({ ok: false, reason: 'MARKUP' });
  });

  it('MARKUP for an obvious SQL injection', () => {
    expect(classifyInput("'; DROP TABLE users; --", 'EN')).toMatchObject({ ok: false, reason: 'MARKUP' });
  });
});

describe('classifyInput — acceptances & normalization', () => {
  it('covid19 → ok, normalized "covid19"', () => {
    expect(classifyInput('covid19', 'EN')).toEqual({ ok: true, normalized: 'covid19', wordCount: 1 });
  });

  it('look forward to → ok, wordCount 3', () => {
    expect(classifyInput('look forward to', 'EN')).toMatchObject({ ok: true, wordCount: 3 });
  });

  it('kick the bucket → ok, wordCount 3', () => {
    expect(classifyInput('kick the bucket', 'EN')).toMatchObject({ ok: true, wordCount: 3 });
  });

  it('collapses internal whitespace: "  run   away " → "run away"', () => {
    expect(classifyInput('  run   away ', 'EN')).toEqual({ ok: true, normalized: 'run away', wordCount: 2 });
  });

  it('¡Hola! (ES) → "hola"', () => {
    expect(classifyInput('¡Hola!', 'ES')).toEqual({ ok: true, normalized: 'hola', wordCount: 1 });
  });

  it("don't keeps the apostrophe", () => {
    expect(classifyInput("don't", 'EN')).toEqual({ ok: true, normalized: "don't", wordCount: 1 });
  });

  it("o'clock keeps the apostrophe", () => {
    expect(classifyInput("o'clock", 'EN')).toEqual({ ok: true, normalized: "o'clock", wordCount: 1 });
  });

  it('mother-in-law is ONE word with hyphens kept', () => {
    expect(classifyInput('mother-in-law', 'EN')).toEqual({ ok: true, normalized: 'mother-in-law', wordCount: 1 });
  });

  it('canción (ES) keeps diacritics', () => {
    expect(classifyInput('canción', 'ES')).toEqual({ ok: true, normalized: 'canción', wordCount: 1 });
  });

  it.each(['él', 'té'])('%j (ES) keeps the accent', (input) => {
    expect(classifyInput(input, 'ES')).toMatchObject({ ok: true, normalized: input });
  });

  it('asdfgh → ok (gibberish is the AI’s job, not validation)', () => {
    expect(classifyInput('asdfgh', 'EN')).toEqual({ ok: true, normalized: 'asdfgh', wordCount: 1 });
  });

  it('HOLA → "hola"', () => {
    expect(classifyInput('HOLA', 'EN')).toEqual({ ok: true, normalized: 'hola', wordCount: 1 });
  });

  it('strips outer quotes/punctuation but keeps the inner word', () => {
    expect(classifyInput('"hello!"', 'EN')).toEqual({ ok: true, normalized: 'hello', wordCount: 1 });
  });
});

describe('messages', () => {
  it('returns a message in the requested language', () => {
    const en = classifyInput('', 'EN');
    const es = classifyInput('', 'ES');
    expect(en).toMatchObject({ ok: false });
    expect(es).toMatchObject({ ok: false });
    if (!en.ok && !es.ok) {
      expect(en.message).not.toEqual(es.message);
      expect(en.message.length).toBeGreaterThan(0);
      expect(es.message.length).toBeGreaterThan(0);
    }
  });
});

describe('normalizeWord (standalone)', () => {
  it('trims, collapses whitespace and lowercases', () => {
    expect(normalizeWord('  Run   AWAY ', 'EN')).toBe('run away');
  });

  it('preserves internal apostrophes/hyphens and diacritics', () => {
    expect(normalizeWord("don't", 'EN')).toBe("don't");
    expect(normalizeWord('Mother-In-Law', 'EN')).toBe('mother-in-law');
    expect(normalizeWord('¡Canción!', 'ES')).toBe('canción');
  });
});
