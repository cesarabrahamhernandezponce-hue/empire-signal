import { describe, it, expect } from 'vitest';

import { analysisSchema, parseAnalysis, resolveWordTypes } from './analysis';

// Minimal valid analysis with a single wordType — mirrors the OLD cached shape
// (records written before wordTypes existed have wordType and no wordTypes).
function baseAnalysis() {
  return {
    version: 1 as const,
    word: 'run',
    essential: {
      meaningInContext: 'to move quickly on foot',
      wordType: { category: 'verb', explanation: 'action of moving fast' },
      pronunciation: { phonetic: '/rʌn/', guide: 'one syllable, short u.' },
      usageExamples: [
        { register: 'formal', example: 'They run every morning.' },
        { register: 'technical', example: 'The process runs in the background.' },
        { register: 'everyday', example: 'I run to catch the bus.' },
      ],
      collocations: [
        { phrase: 'run a marathon', meaning: 'to compete in a long race' },
        { phrase: 'run out of time', meaning: 'to have no time left' },
        { phrase: 'run a business', meaning: 'to manage a company' },
      ],
    },
    advanced: {
      etymology: 'Old English rinnan.',
      story: 'A very common Germanic verb.',
      synonyms: [],
      antonyms: [],
      registerLevel: { level: 'neutral', guidance: 'usable anywhere' },
      commonErrors: [],
      wordFamily: [],
    },
  };
}

describe('analysisSchema — backward compatibility (wordType / wordTypes)', () => {
  it('parses an OLD-shaped record (only wordType, no wordTypes)', () => {
    const old = baseAnalysis();
    const parsed = parseAnalysis(JSON.stringify(old));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.essential.wordType.category).toBe('verb');
      expect(parsed.data.essential.wordTypes).toBeUndefined();
    }
  });

  it('parses a NEW-shaped record (wordType + wordTypes with multiple entries)', () => {
    const next = {
      ...baseAnalysis(),
      essential: {
        ...baseAnalysis().essential,
        wordType: { category: 'verb', explanation: 'action of moving fast' },
        wordTypes: [
          { category: 'verb', explanation: 'action of moving fast' },
          { category: 'noun', explanation: 'an act of running' },
          { category: 'adjective', explanation: 'continuous, as in "running water"' },
        ],
      },
    };
    const parsed = parseAnalysis(JSON.stringify(next));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.essential.wordTypes).toHaveLength(3);
      expect(parsed.data.essential.wordTypes?.map((t) => t.category)).toEqual([
        'verb',
        'noun',
        'adjective',
      ]);
    }
  });

  it('rejects an empty wordTypes array (min 1)', () => {
    const bad = {
      ...baseAnalysis(),
      essential: { ...baseAnalysis().essential, wordTypes: [] },
    };
    expect(analysisSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts the absence of wordTypes (optional)', () => {
    const ok = baseAnalysis();
    expect(analysisSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects more than 4 wordTypes (max 4)', () => {
    const tooMany = {
      ...baseAnalysis(),
      essential: {
        ...baseAnalysis().essential,
        wordTypes: [
          { category: 'verb', explanation: 'a' },
          { category: 'noun', explanation: 'b' },
          { category: 'adjective', explanation: 'c' },
          { category: 'adverb', explanation: 'd' },
          { category: 'preposition', explanation: 'e' },
        ],
      },
    };
    expect(analysisSchema.safeParse(tooMany).success).toBe(false);
  });
});

describe('resolveWordTypes — read-side fallback', () => {
  it('returns the single wordType when wordTypes is undefined', () => {
    const { essential } = baseAnalysis();
    const types = resolveWordTypes(essential);
    expect(types).toHaveLength(1);
    expect(types[0].category).toBe('verb');
  });

  it('returns all wordTypes entries when present', () => {
    const essential = {
      ...baseAnalysis().essential,
      wordTypes: [
        { category: 'verb', explanation: 'a' },
        { category: 'noun', explanation: 'b' },
      ],
    };
    const types = resolveWordTypes(essential);
    expect(types).toHaveLength(2);
    expect(types.map((t) => t.category)).toEqual(['verb', 'noun']);
  });
});
