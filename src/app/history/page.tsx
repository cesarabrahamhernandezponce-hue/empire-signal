'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { loadSessionHistory } from '@/lib/session-history';

type Language = 'en' | 'es';

const UI = {
  en: {
    back:       '← Empire Signal',
    title:      'History',
    subtitle:   'Words you\'ve analyzed. Tap any to see it again.',
    empty:      'No words yet. Analyze one and it\'ll show up here.',
  },
  es: {
    back:       '← Empire Signal',
    title:      'Historial',
    subtitle:   'Palabras que has analizado. Toca cualquiera para verla de nuevo.',
    empty:      'Aún no hay palabras. Analiza una y aparecerá aquí.',
  },
} as const;

type HistoryEntry = { word: string; language: Language };

// Collapse EN/ES duplicates of the same word (mango/mango) to a single row,
// keeping the first occurrence (which carries the language it was analyzed in).
// Normalized key: lowercase + NFD + strip marks.
function dedupeEntries(entries: HistoryEntry[]): HistoryEntry[] {
  const seen = new Set<string>();
  const out: HistoryEntry[] = [];
  for (const e of entries) {
    const key = e.word.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export default function HistoryPage() {
  const [language, setLanguage] = useState<Language>('en');
  const [entries, setEntries]   = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('language');
    // Read persisted language post-mount; server can't know it, so a sync set
    // here is intentional and matches how the home page avoids a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === 'es' || stored === 'en') setLanguage(stored);
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      const user = supabase ? (await supabase.auth.getUser()).data.user : null;
      if (!active) return;

      if (user) {
        try {
          const res = await fetch('/api/signal/history');
          const data: { history: Array<{ word: string; language: string }> } | null =
            res.ok ? await res.json() : null;
          const rows = (data?.history ?? []).map((h) => ({
            word:     h.word,
            language: (h.language === 'es' ? 'es' : 'en') as Language,
          }));
          if (active) setEntries(dedupeEntries(rows));
        } catch {
          if (active) setEntries([]);
        }
      } else {
        setEntries(dedupeEntries(loadSessionHistory().map((e) => ({ word: e.word, language: e.language }))));
      }
    }

    void load();
    return () => { active = false; };
  }, []);

  const t = UI[language];

  return (
    <main className="min-h-screen bg-bg text-ink">
      <div className="mx-auto w-full max-w-2xl px-5 py-6 sm:px-8 sm:py-10">
        <Link
          href="/"
          className="text-xs text-ink-muted hover:text-accent transition-colors"
        >
          {t.back}
        </Link>

        <header className="mt-8 mb-6">
          <h1
            className="text-3xl sm:text-4xl text-ink"
            style={{ fontFamily: 'var(--font-dm-serif)' }}
          >
            {t.title}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">{t.subtitle}</p>
        </header>

        {entries === null ? null : entries.length === 0 ? (
          <p className="mt-16 text-sm text-ink-faint">{t.empty}</p>
        ) : (
          <ul className="border-t border-line">
            {entries.map((e) => (
              <li key={e.word} className="border-b border-line">
                <Link
                  href={`/?w=${encodeURIComponent(e.word)}&lang=${e.language}`}
                  className="block py-4 text-2xl text-ink hover:text-accent transition-colors"
                  style={{ fontFamily: 'var(--font-dm-serif)' }}
                >
                  {e.word}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
