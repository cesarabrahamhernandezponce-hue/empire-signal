import { describe, it, expect, vi, beforeEach } from 'vitest';

// Route-level routing/ordering tests. The dictionary gate's internals are
// covered in word-classifier.test.ts; here we mock the gate and the data layer
// to assert the ROUTE's responsibilities: that the gate runs only on a confirmed
// cache miss, before rate limiting, and that 422/429/200 are routed correctly.

vi.mock('@/lib/services/signal', () => ({
  analyzeWord: vi.fn(),
  findCachedByKey: vi.fn(),
  toLookupKey: vi.fn((w: string) => w),
}));
vi.mock('@/lib/services/word-classifier', () => ({
  resolveDictionaryGate: vi.fn(),
}));
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '1.2.3.4'),
  hashIp: vi.fn(() => 'iphash'),
  checkAnonymousLimit: vi.fn(),
  checkUserLimit: vi.fn(),
  recordAnonymousSearch: vi.fn(),
}));
vi.mock('@/lib/api-guard', () => ({
  isOwnerRequest: vi.fn(() => false),
  isOwnerEmail: vi.fn(() => false),
  readJsonBody: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } })),
}));
vi.mock('@/lib/db/prisma', () => ({
  prisma: { user: { upsert: vi.fn() }, userSearchHistory: { upsert: vi.fn() } },
}));

import { POST } from './route';
import { analyzeWord, findCachedByKey } from '@/lib/services/signal';
import { resolveDictionaryGate } from '@/lib/services/word-classifier';
import { checkAnonymousLimit, recordAnonymousSearch } from '@/lib/rate-limit';
import { readJsonBody } from '@/lib/api-guard';

const mockedAnalyze = vi.mocked(analyzeWord);
const mockedFindCached = vi.mocked(findCachedByKey);
const mockedGate = vi.mocked(resolveDictionaryGate);
const mockedAnonLimit = vi.mocked(checkAnonymousLimit);
const mockedRecordAnon = vi.mocked(recordAnonymousSearch);
const mockedReadBody = vi.mocked(readJsonBody);

const RECORD = {
  id: 'r1',
  word: 'ephemeral',
  context: null,
  language: 'EN',
  analysis: {} as never,
  shareId: 's1',
};

function request() {
  return new Request('http://localhost/api/signal/analyze', { method: 'POST' });
}

function body(word: string, language: 'es' | 'en' = 'en', force = false) {
  mockedReadBody.mockResolvedValue({ ok: true, body: { word, language, force } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedAnonLimit.mockResolvedValue({ allowed: true, remaining: 4, limit: 5 });
});

describe('POST /api/signal/analyze — gate ordering', () => {
  it('cache HIT → neither dictionary/classifier gate nor rate limit-blocking path runs, returns 200', async () => {
    body('ephemeral');
    mockedFindCached.mockResolvedValue(RECORD as never);
    mockedAnalyze.mockResolvedValue({ ok: true, record: RECORD as never, cacheHit: true, model: null });

    const res = await POST(request());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.cacheHit).toBe(true);
    expect(mockedGate).not.toHaveBeenCalled();
    expect(mockedAnalyze).toHaveBeenCalledTimes(1);
  });

  it('cache MISS + gate ok → gate called once, proceeds to analysis (200)', async () => {
    body('rizz');
    mockedFindCached.mockResolvedValue(null);
    mockedGate.mockResolvedValue({ ok: true });
    mockedAnalyze.mockResolvedValue({ ok: true, record: RECORD as never, cacheHit: false, model: 'gemini:gemini-2.5-flash-lite' });

    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(mockedGate).toHaveBeenCalledTimes(1);
    expect(mockedGate).toHaveBeenCalledWith({ word: 'rizz', language: 'en', force: false });
    expect(mockedAnalyze).toHaveBeenCalledTimes(1);
  });

  it('cache MISS + gate misspelling → 422 with suggestion + canForce; analysis and rate limit NOT reached', async () => {
    body('recieve');
    mockedFindCached.mockResolvedValue(null);
    mockedGate.mockResolvedValue({ ok: false, reason: 'misspelling', suggestion: 'receive' });

    const res = await POST(request());
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.suggestion).toBe('receive');
    expect(data.canForce).toBe(true);
    expect(mockedAnalyze).not.toHaveBeenCalled();
    expect(mockedAnonLimit).not.toHaveBeenCalled();
  });

  it('cache MISS + gate not_a_word → 422 with null suggestion and a "not recognized" message', async () => {
    body('asdfgh');
    mockedFindCached.mockResolvedValue(null);
    mockedGate.mockResolvedValue({ ok: false, reason: 'not_a_word', suggestion: null });

    const res = await POST(request());
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.suggestion).toBeNull();
    expect(data.error).toMatch(/recognized/i);
    expect(mockedAnalyze).not.toHaveBeenCalled();
  });

  it('cache MISS + gate ok but anonymous over limit → 429 (rate limit runs AFTER the gate)', async () => {
    body('rizz');
    mockedFindCached.mockResolvedValue(null);
    mockedGate.mockResolvedValue({ ok: true });
    mockedAnonLimit.mockResolvedValue({ allowed: false, remaining: 0, limit: 5 });

    const res = await POST(request());
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toBe('limit_reached');
    expect(mockedGate).toHaveBeenCalledTimes(1);
    expect(mockedAnalyze).not.toHaveBeenCalled();
  });

  it('DB error (cache lookup throws) → gate is SKIPPED (uncertain miss), analysis still proceeds', async () => {
    body('rizz');
    mockedFindCached.mockRejectedValue(new Error('db down'));
    mockedAnalyze.mockResolvedValue({ ok: true, record: RECORD as never, cacheHit: false, model: 'gemini:gemini-2.5-flash-lite' });

    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(mockedGate).not.toHaveBeenCalled();
    expect(mockedAnalyze).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/signal/analyze — anonymous quota charged only on success', () => {
  it('successful analysis → records the anonymous search once', async () => {
    body('rizz');
    mockedFindCached.mockResolvedValue(null);
    mockedGate.mockResolvedValue({ ok: true });
    mockedAnalyze.mockResolvedValue({ ok: true, record: RECORD as never, cacheHit: false, model: 'gemini:gemini-2.5-flash-lite' });

    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(mockedRecordAnon).toHaveBeenCalledTimes(1);
    expect(mockedRecordAnon).toHaveBeenCalledWith('iphash');
  });

  it('AI failure (503) → does NOT charge the anonymous quota', async () => {
    body('rizz');
    mockedFindCached.mockResolvedValue(null);
    mockedGate.mockResolvedValue({ ok: true });
    mockedAnalyze.mockResolvedValue({ ok: false, error: 'The AI service is temporarily busy.' });

    const res = await POST(request());

    expect(res.status).toBe(503);
    expect(mockedRecordAnon).not.toHaveBeenCalled();
  });

  it('WORD_NOT_FOUND (422) → does NOT charge the anonymous quota', async () => {
    body('rizz');
    mockedFindCached.mockResolvedValue(null);
    mockedGate.mockResolvedValue({ ok: true });
    mockedAnalyze.mockResolvedValue({ ok: false, error: 'WORD_NOT_FOUND', suggestion: null });

    const res = await POST(request());

    expect(res.status).toBe(422);
    expect(mockedRecordAnon).not.toHaveBeenCalled();
  });

  it('cache hit still charges the quota (anonymous limit counts cache hits)', async () => {
    body('ephemeral');
    mockedFindCached.mockResolvedValue(RECORD as never);
    mockedAnalyze.mockResolvedValue({ ok: true, record: RECORD as never, cacheHit: true, model: null });

    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(mockedRecordAnon).toHaveBeenCalledTimes(1);
  });
});
