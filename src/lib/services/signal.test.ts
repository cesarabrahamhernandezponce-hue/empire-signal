import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

// Unit tests for analyzeWord's branching: cache hit, cache miss + parse,
// retry-on-parse-failure, the WORD_NOT_FOUND sentinel, P2002 concurrency
// recovery, and the DB-write-failure fallback. The AI client and Prisma are
// mocked so no network or database is touched.

vi.mock('@/lib/ai/client', () => ({
  generateContent: vi.fn(),
}));
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    searchRecord: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    searchEvent: { create: vi.fn(() => Promise.resolve({})) },
  },
}));

import { analyzeWord } from './signal';
import { generateContent } from '@/lib/ai/client';
import { prisma } from '@/lib/db/prisma';
import type { Analysis } from '@/lib/ai/schemas/analysis';

const mockedGenerate = vi.mocked(generateContent);
const mockedCreate = vi.mocked(prisma.searchRecord.create);
const mockedFindFirst = vi.mocked(prisma.searchRecord.findFirst);

function validAnalysis(word = 'run'): Analysis {
  return {
    version: 1,
    word,
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

function aiOk(text: string) {
  return { ok: true as const, text, provider: 'gemini', model: 'gemini-2.5-flash-lite' };
}

function createdRecord(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'rec-1',
    word: 'run',
    context: null,
    language: 'EN',
    shareId: 'share-1',
    analysisJson: validAnalysis(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeWord — cache hit (prefetched)', () => {
  it('returns the prefetched record without calling the AI', async () => {
    const prefetched = {
      id: 'rec-1',
      word: 'run',
      context: null,
      language: 'EN' as const,
      analysis: validAnalysis(),
      shareId: 'share-1',
    };

    const result = await analyzeWord({
      word: 'run',
      context: null,
      language: 'en',
      prefetched,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cacheHit).toBe(true);
      expect(result.model).toBeNull();
      expect(result.record.id).toBe('rec-1');
    }
    expect(mockedGenerate).not.toHaveBeenCalled();
    expect(prisma.searchEvent.create).toHaveBeenCalledTimes(1);
  });
});

describe('analyzeWord — cache miss', () => {
  it('parses a valid analysis, persists it, and returns cacheHit:false with the model', async () => {
    mockedGenerate.mockResolvedValue(aiOk(JSON.stringify(validAnalysis())));
    mockedCreate.mockResolvedValue(createdRecord() as never);

    const result = await analyzeWord({
      word: 'run',
      context: null,
      language: 'en',
      prefetched: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cacheHit).toBe(false);
      expect(result.model).toBe('gemini:gemini-2.5-flash-lite');
      expect(result.record.id).toBe('rec-1');
    }
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('propagates an AI failure as ok:false', async () => {
    mockedGenerate.mockResolvedValue({ ok: false, error: 'all providers down' });

    const result = await analyzeWord({
      word: 'run',
      context: null,
      language: 'en',
      prefetched: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('all providers down');
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('returns WORD_NOT_FOUND with a normalized suggestion for the sentinel response', async () => {
    mockedGenerate.mockResolvedValue(
      aiOk(JSON.stringify({ error: 'WORD_NOT_FOUND', suggestion: 'Hello' })),
    );

    const result = await analyzeWord({
      word: 'helo',
      context: null,
      language: 'en',
      prefetched: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('WORD_NOT_FOUND');
      expect(result.suggestion).toBe('hello');
    }
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('retries once when the first parse fails, then succeeds on the second', async () => {
    mockedGenerate
      .mockResolvedValueOnce(aiOk('{}'))
      .mockResolvedValueOnce(aiOk(JSON.stringify(validAnalysis())));
    mockedCreate.mockResolvedValue(createdRecord() as never);

    const result = await analyzeWord({
      word: 'run',
      context: null,
      language: 'en',
      prefetched: null,
    });

    expect(result.ok).toBe(true);
    expect(mockedGenerate).toHaveBeenCalledTimes(2);
  });

  it('gives up after a failed retry parse', async () => {
    mockedGenerate
      .mockResolvedValueOnce(aiOk('{}'))
      .mockResolvedValueOnce(aiOk('{}'));

    const result = await analyzeWord({
      word: 'run',
      context: null,
      language: 'en',
      prefetched: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/valid analysis/i);
    expect(mockedCreate).not.toHaveBeenCalled();
  });
});

describe('analyzeWord — DB write outcomes', () => {
  it('recovers from a P2002 unique-constraint clash by returning the existing record', async () => {
    mockedGenerate.mockResolvedValue(aiOk(JSON.stringify(validAnalysis())));
    mockedCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );
    mockedFindFirst.mockResolvedValue(createdRecord({ id: 'existing-1' }) as never);

    const result = await analyzeWord({
      word: 'run',
      context: null,
      language: 'en',
      prefetched: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cacheHit).toBe(false);
      expect(result.record.id).toBe('existing-1');
    }
    expect(mockedFindFirst).toHaveBeenCalledTimes(1);
  });

  it('returns the analysis with empty ids when the DB write fails outright', async () => {
    mockedGenerate.mockResolvedValue(aiOk(JSON.stringify(validAnalysis())));
    mockedCreate.mockRejectedValue(new Error('connection refused'));

    const result = await analyzeWord({
      word: 'run',
      context: null,
      language: 'en',
      prefetched: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cacheHit).toBe(false);
      expect(result.record.id).toBe('');
      expect(result.record.shareId).toBe('');
      expect(result.record.word).toBe('run');
    }
  });
});
