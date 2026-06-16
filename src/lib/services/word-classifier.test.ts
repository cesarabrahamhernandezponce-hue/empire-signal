import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { resolveDictionaryGate, classifyWord } from './word-classifier';
import { generateContent } from '../ai/client';

vi.mock('../ai/client', () => ({
  generateContent: vi.fn(),
}));

const mockedGenerate = vi.mocked(generateContent);

// Helper: stub global.fetch to return a Response-like object with the given
// status, or to reject (timeout/network).
function stubFetch(status: number) {
  return vi.fn(async () => ({ status }) as Response);
}
function stubFetchReject() {
  return vi.fn(async () => {
    throw new Error('aborted');
  });
}

function aiJson(obj: unknown) {
  mockedGenerate.mockResolvedValue({ ok: true, text: JSON.stringify(obj), model: 'test-model', provider: 'test' });
}

beforeEach(() => {
  mockedGenerate.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveDictionaryGate — skip conditions (no dictionary call)', () => {
  it('skips for Spanish', async () => {
    const fetchSpy = stubFetch(404);
    vi.stubGlobal('fetch', fetchSpy);
    const r = await resolveDictionaryGate({ word: 'maceo', language: 'es', force: false });
    expect(r).toEqual({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it('skips for multi-word phrases', async () => {
    const fetchSpy = stubFetch(404);
    vi.stubGlobal('fetch', fetchSpy);
    const r = await resolveDictionaryGate({ word: 'look forward to', language: 'en', force: false });
    expect(r).toEqual({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips when force is set (analyze anyway)', async () => {
    const fetchSpy = stubFetch(404);
    vi.stubGlobal('fetch', fetchSpy);
    const r = await resolveDictionaryGate({ word: 'rizz', language: 'en', force: true });
    expect(r).toEqual({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('resolveDictionaryGate — dictionary outcomes', () => {
  it('dictionary 200 → proceeds, classification NEVER called', async () => {
    vi.stubGlobal('fetch', stubFetch(200));
    const r = await resolveDictionaryGate({ word: 'ephemeral', language: 'en', force: false });
    expect(r).toEqual({ ok: true });
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it('dictionary timeout/error → proceeds without validation (graceful)', async () => {
    vi.stubGlobal('fetch', stubFetchReject());
    const r = await resolveDictionaryGate({ word: 'rizz', language: 'en', force: false });
    expect(r).toEqual({ ok: true });
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it('non-404 non-200 status (e.g. 500) → proceeds, no classification', async () => {
    vi.stubGlobal('fetch', stubFetch(500));
    const r = await resolveDictionaryGate({ word: 'rizz', language: 'en', force: false });
    expect(r).toEqual({ ok: true });
    expect(mockedGenerate).not.toHaveBeenCalled();
  });
});

describe('resolveDictionaryGate — 404 → classification routing', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', stubFetch(404));
  });

  it('classify → valid → proceeds (no 422)', async () => {
    aiJson({ status: 'valid', suggestion: null, category: 'slang' });
    const r = await resolveDictionaryGate({ word: 'rizz', language: 'en', force: false });
    expect(r).toEqual({ ok: true });
    expect(mockedGenerate).toHaveBeenCalledTimes(1);
  });

  it('classify → misspelling → reject with suggestion', async () => {
    aiJson({ status: 'misspelling', suggestion: 'receive', category: null });
    const r = await resolveDictionaryGate({ word: 'recieve', language: 'en', force: false });
    expect(r).toEqual({ ok: false, reason: 'misspelling', suggestion: 'receive' });
  });

  it('classify → not_a_word → reject with null suggestion (never invents)', async () => {
    aiJson({ status: 'not_a_word', suggestion: null, category: null });
    const r = await resolveDictionaryGate({ word: 'asdfgh', language: 'en', force: false });
    expect(r).toEqual({ ok: false, reason: 'not_a_word', suggestion: null });
  });

  it('not_a_word with a stray suggestion is still nulled out', async () => {
    aiJson({ status: 'not_a_word', suggestion: 'something', category: null });
    const r = await resolveDictionaryGate({ word: 'asdfgh', language: 'en', force: false });
    expect(r).toEqual({ ok: false, reason: 'not_a_word', suggestion: null });
  });

  it('misspelling whose suggestion equals the input drops the suggestion', async () => {
    aiJson({ status: 'misspelling', suggestion: 'rizz', category: null });
    const r = await resolveDictionaryGate({ word: 'rizz', language: 'en', force: false });
    expect(r).toEqual({ ok: false, reason: 'misspelling', suggestion: null });
  });

  it('malformed classifier JSON → falls back to valid → proceeds', async () => {
    mockedGenerate.mockResolvedValue({ ok: true, text: 'not json at all {', model: 'test-model', provider: 'test' });
    const r = await resolveDictionaryGate({ word: 'rizz', language: 'en', force: false });
    expect(r).toEqual({ ok: true });
  });

  it('classifier AI failure → falls back to valid → proceeds', async () => {
    mockedGenerate.mockResolvedValue({ ok: false, error: 'busy' });
    const r = await resolveDictionaryGate({ word: 'rizz', language: 'en', force: false });
    expect(r).toEqual({ ok: true });
  });

  it('classifier throws → falls back to valid → proceeds', async () => {
    mockedGenerate.mockRejectedValue(new Error('network'));
    const r = await resolveDictionaryGate({ word: 'rizz', language: 'en', force: false });
    expect(r).toEqual({ ok: true });
  });

  it('unknown status value fails Zod → falls back to valid', async () => {
    aiJson({ status: 'maybe', suggestion: null, category: null });
    const r = await resolveDictionaryGate({ word: 'rizz', language: 'en', force: false });
    expect(r).toEqual({ ok: true });
  });
});

describe('classifyWord — fallback behavior', () => {
  it('returns valid on AI failure', async () => {
    mockedGenerate.mockResolvedValue({ ok: false, error: 'busy' });
    expect(await classifyWord('rizz')).toEqual({ status: 'valid', suggestion: null, category: null });
  });

  it('parses a well-formed classification', async () => {
    aiJson({ status: 'valid', suggestion: null, category: 'acronym' });
    expect(await classifyWord('NASA')).toMatchObject({ status: 'valid', category: 'acronym' });
  });
});
