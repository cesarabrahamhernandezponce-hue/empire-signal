// Lightweight, client-only session search history for anonymous users.
// Persists just the searched word + the language it was searched in — never
// the heavy AnalyzeRecord. Registered users use the DB-backed history instead;
// the two are never mixed. All localStorage access is wrapped so a blocked or
// full store (incognito, quota, permissions) silently degrades to in-memory.

export type SessionHistoryEntry = { word: string; language: 'en' | 'es' };

const STORAGE_KEY = 'empire-signal-history-v1';
const MAX_ITEMS = 10;

function isEntry(value: unknown): value is SessionHistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const e = value as Record<string, unknown>;
  return typeof e.word === 'string' && (e.language === 'en' || e.language === 'es');
}

export function loadSessionHistory(): SessionHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

// Remove a word from the stored history (used when the user deletes a chip).
// Returns the new list so callers can keep state in sync even if the write fails.
export function removeSessionHistory(word: string): SessionHistoryEntry[] {
  const next = loadSessionHistory().filter((e) => e.word !== word);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Store unavailable/full — keep going with the in-memory list.
  }
  return next;
}

// Prepend a freshly analyzed word, drop any earlier duplicate, cap the list,
// and persist. Returns the new list so callers can keep state in sync even
// when the write itself fails.
export function addSessionHistory(word: string, language: 'en' | 'es'): SessionHistoryEntry[] {
  const current = loadSessionHistory();
  const filtered = current.filter((e) => e.word !== word);
  const next = [{ word, language }, ...filtered].slice(0, MAX_ITEMS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Store unavailable/full — keep going with the in-memory list.
  }
  return next;
}
