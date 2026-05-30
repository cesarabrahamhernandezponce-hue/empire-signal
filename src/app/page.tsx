'use client';

import { useState, useEffect } from 'react';
import AnalysisResult, { type AnalyzeRecord } from '@/components/AnalysisResult';

const CURIOSITIES = [
  'Did you know Spanish has over 500 million native speakers, making it the world\'s second most spoken language?',
  'Did you know the word "robot" was coined in 1920 by Czech writer Karel Čapek, from the Slavic "robota" meaning forced labor?',
  'Did you know "salary" comes from the Latin "salarium" — the payment in salt given to Roman soldiers?',
  'Did you know "avocado" comes from the Nahuatl word "ahuácatl"? The Aztecs named it for its distinctive shape.',
  'Did you know the word "set" has over 430 definitions in the Oxford Dictionary? It\'s the most polysemous word in English.',
  'Did you know "hurricane" comes from "Huracán", the wind god worshipped by the indigenous peoples of the Caribbean?',
  'Did you know the Ubykh language of the Caucasus, now extinct, had 84 distinct consonants? English has just 24.',
  'Did you know "queue" is the only word in English that sounds the same even if you remove its last four letters?',
  'Did you know the Silbo Gomero, a whistled language from La Gomera in the Canary Islands, has full grammar recognized by UNESCO?',
  'Did you know the !Xóõ language of Botswana has over 100 distinct phonemes? It\'s the language with the most sounds in the world.',
];

const TONES = [
  { id: 'practico',  label: 'Practical' },
  { id: 'academico', label: 'Academic' },
  { id: 'creativo',  label: 'Creative' },
  { id: 'infantil',  label: 'Simple' },
] as const;

type Tone = (typeof TONES)[number]['id'];

type PageState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; record: AnalyzeRecord }
  | { status: 'error'; message: string };

export default function Home() {
  const [word, setWord]                         = useState('');
  const [context, setContext]                   = useState('');
  const [showContext, setShowContext]           = useState(false);
  const [tone, setTone]                         = useState<Tone>('practico');
  const [curiosity, setCuriosity]               = useState('');
  const [curiosityVisible, setCuriosityVisible] = useState(true);
  const [pageState, setPageState]               = useState<PageState>({ status: 'idle' });

  useEffect(() => {
    setCuriosity(CURIOSITIES[Math.floor(Math.random() * CURIOSITIES.length)]);
  }, []);

  const handleWordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setWord(val);
    setCuriosityVisible(val.length === 0);
  };

  const handleAnalyze = async () => {
    const trimmed = word.trim();
    if (!trimmed) return;

    setPageState({ status: 'loading' });

    try {
      const res = await fetch('/api/signal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: trimmed,
          context: context.trim() || null,
          tone,
          language: 'en',
        }),
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        const message = (data as { error?: string }).error ?? 'Unknown server error.';
        setPageState({ status: 'error', message });
        return;
      }

      const record = (data as { record: AnalyzeRecord }).record;
      setPageState({ status: 'result', record });
    } catch {
      setPageState({ status: 'error', message: 'Could not connect to the server. Check your connection.' });
    }
  };

  const handleReset = () => {
    setPageState({ status: 'idle' });
  };

  const canAnalyze = word.trim().length > 0;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (pageState.status === 'loading') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-5 h-5 border-2 border-line border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-ink-muted">Analyzing...</p>
        </div>
      </div>
    );
  }

  // ── Result ───────────────────────────────────────────────────────────────
  if (pageState.status === 'result') {
    return <AnalysisResult record={pageState.record} onReset={handleReset} />;
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (pageState.status === 'error') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-sm text-ink mb-1">Something went wrong</p>
          <p className="text-sm text-ink-muted mb-6">{pageState.message}</p>
          <button
            onClick={handleReset}
            className="text-sm text-accent hover:text-accent-hover transition-colors duration-150"
          >
            ← Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Idle ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-16">

      {/* Brand */}
      <div className="text-center mb-10">
        <h1 className="text-[2.75rem] font-bold tracking-tight text-ink leading-none">
          Empire
        </h1>
        <p className="mt-2.5 text-sm text-ink-muted tracking-[0.06em]">
          Linguistic intelligence
        </p>
      </div>

      {/* Curiosity */}
      <div
        className={`w-full max-w-[600px] mb-5 transition-opacity duration-500 ${
          curiosityVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-accent mb-1.5">
          Empire Insight
        </p>
        <p className="text-sm text-ink-muted leading-relaxed" suppressHydrationWarning>
          {curiosity}
        </p>
      </div>

      {/* Search card */}
      <div className="w-full max-w-[600px] bg-surface border border-line rounded-[12px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">

        {/* Input — protagonist */}
        <div className="px-7 pt-7 pb-6">
          <input
            type="text"
            value={word}
            onChange={handleWordChange}
            onKeyDown={(e) => e.key === 'Enter' && canAnalyze && handleAnalyze()}
            placeholder="Type a word..."
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-transparent text-[1.5rem] font-medium text-ink placeholder:text-ink-faint outline-none border-b-2 border-line focus:border-accent transition-colors duration-200 pb-1"
          />
        </div>

        {/* Section divider */}
        <div className="h-px bg-line" />

        {/* Options */}
        <div className="px-7 py-6 space-y-5">

          {/* Context toggle */}
          <div>
            <button
              onClick={() => setShowContext((v) => !v)}
              className="text-sm text-ink-faint hover:text-ink-muted transition-colors duration-150"
            >
              {showContext ? '− Hide context' : '+ Add context (optional)'}
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                showContext ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g. I'm reading a 19th-century medical text..."
                  rows={3}
                  className="mt-3 w-full bg-bg border border-line rounded-lg px-4 py-3 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent resize-none transition-colors duration-150"
                />
              </div>
            </div>
          </div>

          {/* Tone selector */}
          <div className="flex flex-wrap gap-1.5">
            {TONES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTone(t.id)}
                className={`px-3 py-1 rounded-[6px] text-xs font-medium border transition-all duration-150 ${
                  tone === t.id
                    ? 'bg-accent text-white border-accent'
                    : 'bg-bg text-ink-muted border-line hover:text-ink hover:border-ink-muted'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Analyze button */}
          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className={`w-full py-3 rounded-lg text-sm font-medium text-white transition-colors duration-150 ${
              canAnalyze
                ? 'bg-accent hover:bg-accent-hover cursor-pointer'
                : 'bg-accent opacity-40 cursor-not-allowed'
            }`}
          >
            Analyze
          </button>
        </div>
      </div>
    </main>
  );
}
