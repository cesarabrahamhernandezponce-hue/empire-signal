import { describe, it, expect } from 'vitest';

import { parseTranslation } from './translation';

describe('parseTranslation', () => {
  it('parses a valid record and confirms all expected keys', () => {
    const raw = JSON.stringify({ fr: 'bonjour', de: 'hallo' });
    const result = parseTranslation(raw, ['fr', 'de']);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fr).toBe('bonjour');
      expect(result.data.de).toBe('hallo');
    }
  });

  it('strips a ```json markdown fence before parsing', () => {
    const raw = '```json\n{"fr":"bonjour"}\n```';
    const result = parseTranslation(raw, ['fr']);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.fr).toBe('bonjour');
  });

  it('fails on invalid JSON', () => {
    const result = parseTranslation('not json at all', ['fr']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/JSON/i);
  });

  it('fails when an expected key is missing', () => {
    const raw = JSON.stringify({ fr: 'bonjour' });
    const result = parseTranslation(raw, ['fr', 'de']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/de/);
  });

  it('fails when an expected key is present but empty', () => {
    const raw = JSON.stringify({ fr: 'bonjour', de: '' });
    const result = parseTranslation(raw, ['fr', 'de']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/de/);
  });

  it('fails when a value is not a string', () => {
    const raw = JSON.stringify({ fr: 42 });
    const result = parseTranslation(raw, ['fr']);
    expect(result.ok).toBe(false);
  });

  it('accepts any record when no expected keys are given', () => {
    const raw = JSON.stringify({ anything: 'goes' });
    const result = parseTranslation(raw);
    expect(result.ok).toBe(true);
  });
});
