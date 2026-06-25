import { describe, it, expect } from 'vitest';

import { parseClassification } from './classification';

describe('parseClassification', () => {
  it('parses a valid "valid" status with category', () => {
    const raw = JSON.stringify({ status: 'valid', category: 'slang' });
    const result = parseClassification(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('valid');
      expect(result.data.category).toBe('slang');
      expect(result.data.suggestion).toBeNull();
    }
  });

  it('parses a "misspelling" status with a suggestion', () => {
    const raw = JSON.stringify({ status: 'misspelling', suggestion: 'receive' });
    const result = parseClassification(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('misspelling');
      expect(result.data.suggestion).toBe('receive');
    }
  });

  it('coerces a missing suggestion/category to null', () => {
    const raw = JSON.stringify({ status: 'not_a_word' });
    const result = parseClassification(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.suggestion).toBeNull();
      expect(result.data.category).toBeNull();
    }
  });

  it('strips a markdown fence before parsing', () => {
    const raw = '```json\n{"status":"valid"}\n```';
    const result = parseClassification(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe('valid');
  });

  it('rejects an invalid status enum value', () => {
    const raw = JSON.stringify({ status: 'maybe' });
    const result = parseClassification(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/status/);
  });

  it('rejects an invalid category enum value', () => {
    const raw = JSON.stringify({ status: 'valid', category: 'nonsense' });
    const result = parseClassification(raw);
    expect(result.ok).toBe(false);
  });

  it('fails on invalid JSON', () => {
    const result = parseClassification('}{');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/JSON/i);
  });
});
