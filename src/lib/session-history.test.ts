import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  loadSessionHistory,
  addSessionHistory,
  removeSessionHistory,
} from './session-history';

const STORAGE_KEY = 'empire-signal-history-v1';

function makeLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeLocalStorage());
});

describe('loadSessionHistory', () => {
  it('returns [] when nothing is stored', () => {
    expect(loadSessionHistory()).toEqual([]);
  });

  it('returns [] on malformed JSON without throwing', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadSessionHistory()).toEqual([]);
  });

  it('returns [] when stored value is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ word: 'x', language: 'en' }));
    expect(loadSessionHistory()).toEqual([]);
  });

  it('filters out entries with a bad shape', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { word: 'good', language: 'en' },
        { word: 'nolang' },
        { word: 'badlang', language: 'fr' },
        'string-entry',
      ]),
    );
    expect(loadSessionHistory()).toEqual([{ word: 'good', language: 'en' }]);
  });

  it('caps a bloated stored list at 10 items', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ word: `w${i}`, language: 'en' as const }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(many));
    expect(loadSessionHistory()).toHaveLength(10);
  });
});

describe('addSessionHistory', () => {
  it('prepends the newest word', () => {
    addSessionHistory('first', 'en');
    const next = addSessionHistory('second', 'es');
    expect(next[0]).toEqual({ word: 'second', language: 'es' });
    expect(next[1]).toEqual({ word: 'first', language: 'en' });
  });

  it('dedupes: re-adding a word moves it to the front, not duplicated', () => {
    addSessionHistory('a', 'en');
    addSessionHistory('b', 'en');
    const next = addSessionHistory('a', 'es');
    expect(next).toEqual([
      { word: 'a', language: 'es' },
      { word: 'b', language: 'en' },
    ]);
  });

  it('caps the list at 10 items', () => {
    let list = loadSessionHistory();
    for (let i = 0; i < 15; i++) list = addSessionHistory(`w${i}`, 'en');
    expect(list).toHaveLength(10);
    expect(list[0]).toEqual({ word: 'w14', language: 'en' });
  });

  it('persists across calls', () => {
    addSessionHistory('persisted', 'en');
    expect(loadSessionHistory()).toEqual([{ word: 'persisted', language: 'en' }]);
  });
});

describe('removeSessionHistory', () => {
  it('drops the matching word and returns the rest', () => {
    addSessionHistory('keep', 'en');
    addSessionHistory('drop', 'en');
    const next = removeSessionHistory('drop');
    expect(next).toEqual([{ word: 'keep', language: 'en' }]);
    expect(loadSessionHistory()).toEqual([{ word: 'keep', language: 'en' }]);
  });

  it('is a no-op for a word that is not present', () => {
    addSessionHistory('keep', 'en');
    expect(removeSessionHistory('absent')).toEqual([{ word: 'keep', language: 'en' }]);
  });
});
