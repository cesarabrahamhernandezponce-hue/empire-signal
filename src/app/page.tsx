'use client';

import { useState, useEffect, useRef } from 'react';
import AnalysisResult, { type AnalyzeRecord } from '@/components/AnalysisResult';

const CURIOSITIES: Record<'en' | 'es', string[]> = {
  en: [
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
  ],
  es: [
    '¿Sabías que el español es el único idioma romance con una letra propia, la ñ, que no deriva de ninguna lengua latina clásica?',
    '¿Sabías que la palabra "robot" fue acuñada en 1920 por el escritor checo Karel Čapek, del eslavo "robota" que significa trabajo forzado?',
    '¿Sabías que "salario" viene del latín "salarium", el pago en sal que recibían los soldados romanos?',
    '¿Sabías que "aguacate" viene del náhuatl "ahuácatl"? Los aztecas lo nombraron así por su forma característica.',
    '¿Sabías que la palabra "set" tiene más de 430 definiciones en el diccionario Oxford? Es la palabra más polisémica del inglés.',
    '¿Sabías que "huracán" viene de "Huracán", el dios del viento venerado por los pueblos indígenas del Caribe?',
    '¿Sabías que el ubykh del Cáucaso, ya extinto, tenía 84 consonantes distintas? El español tiene solo 19.',
    '¿Sabías que el español tiene dos formas de decir "ser": ser y estar, una distinción que muy pocos idiomas del mundo comparten?',
    '¿Sabías que el silbo gomero, un lenguaje silbado de La Gomera (Canarias), tiene gramática completa y está reconocido por la UNESCO?',
    '¿Sabías que el idioma !Xóõ de Botsuana tiene más de 100 fonemas distintos? Es el idioma con más sonidos del mundo.',
  ],
};

const UI = {
  en: {
    insightLabel:    'Empire Insight',
    tagline:         'Linguistic intelligence',
    placeholder:     'Type a word...',
    contextHint:     "e.g. I'm reading a 19th-century medical text...",
    addContext:      '+ Add context (optional)',
    hideContext:     '− Hide context',
    translate:       'Translate',
    translating:     'Translating',
    analyze:         'Analyze',
    analyzing:       'Analyzing...',
    errorTitle:      'Something went wrong',
    tryAgain:        '← Try again',
    toneLabels:      ['Practical', 'Academic', 'Creative', 'Simple'] as const,
    langLabel:       'Language',
    themeLabel:      'Theme',
    light:           'Light',
    dark:            'Dark',
  },
  es: {
    insightLabel:    'Perspectiva Empire',
    tagline:         'Inteligencia lingüística',
    placeholder:     'Escribe una palabra...',
    contextHint:     'ej. Estoy leyendo un texto médico del siglo XIX...',
    addContext:      '+ Agregar contexto (opcional)',
    hideContext:     '− Ocultar contexto',
    translate:       'Traducir',
    translating:     'Traduciendo',
    analyze:         'Analizar',
    analyzing:       'Analizando...',
    errorTitle:      'Algo salió mal',
    tryAgain:        '← Intentar de nuevo',
    toneLabels:      ['Práctico', 'Académico', 'Creativo', 'Simple'] as const,
    langLabel:       'Idioma',
    themeLabel:      'Tema',
    light:           'Claro',
    dark:            'Oscuro',
  },
} as const;

const TONES = [
  { id: 'practico',  label: 'Practical' },
  { id: 'academico', label: 'Academic' },
  { id: 'creativo',  label: 'Creative' },
  { id: 'infantil',  label: 'Simple' },
] as const;

const TRANSLATE_LANGS = [
  { id: 'es', label: 'Spanish'    },
  { id: 'fr', label: 'French'     },
  { id: 'de', label: 'German'     },
  { id: 'zh', label: 'Chinese'    },
] as const;

type TranslateLang = (typeof TRANSLATE_LANGS)[number]['id'];

type TranslationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; text: string; lang: TranslateLang }
  | { status: 'error'; message: string };

type Tone     = (typeof TONES)[number]['id'];
type Language = 'en' | 'es';

type PageState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; record: AnalyzeRecord }
  | { status: 'error'; message: string };

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="5" y="5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 9V3C2 2.4 2.4 2 3 2H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6.5 1.5h3l.4 1.4c.4.2.8.4 1.1.7l1.4-.4 1.5 2.6-1 1c0 .2.1.5.1.7s0 .5-.1.7l1 1-1.5 2.6-1.4-.4c-.3.3-.7.5-1.1.7l-.4 1.4h-3l-.4-1.4a4.5 4.5 0 0 1-1.1-.7l-1.4.4-1.5-2.6 1-1A4.5 4.5 0 0 1 3 8c0-.2 0-.5.1-.7l-1-1 1.5-2.6 1.4.4c.3-.3.7-.5 1.1-.7l.4-1.4Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export default function Home() {
  const [word, setWord]                         = useState('');
  const [context, setContext]                   = useState('');
  const [showContext, setShowContext]           = useState(false);
  const [tone, setTone]                         = useState<Tone>('practico');
  const [language, setLanguage]                 = useState<Language>('en');
  const [theme, setTheme]                       = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') ?? 'light';
    }
    return 'light';
  });
  const [settingsOpen, setSettingsOpen]         = useState(false);
  const [curiosity, setCuriosity]               = useState('');
  const [curiosityVisible, setCuriosityVisible] = useState(true);
  const [pageState, setPageState]               = useState<PageState>({ status: 'idle' });
  const [spellingError, setSpellingError]       = useState<string | null>(null);
  const [targetLang, setTargetLang]             = useState<TranslateLang>('es');
  const [translationState, setTranslationState] = useState<TranslationState>({ status: 'idle' });
  const settingsRef                             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pool = CURIOSITIES[language];
    setCuriosity(pool[Math.floor(Math.random() * pool.length)]);
  }, [language]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!settingsOpen) return;
    function handler(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [settingsOpen]);

  const handleWordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setWord(val);
    setCuriosityVisible(val.length === 0);
    setTranslationState({ status: 'idle' });
    setSpellingError(null);
  };

  const handleTranslate = async () => {
    const trimmed = word.trim();
    if (!trimmed) return;
    setTranslationState({ status: 'loading' });
    try {
      const res = await fetch('/api/signal/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: trimmed, targetLanguages: [targetLang] }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        setTranslationState({ status: 'error', message: (data as { error?: string }).error ?? 'Translation failed.' });
        return;
      }
      const translations = (data as { translations: Record<string, string> }).translations;
      const text = translations[targetLang];
      if (!text) {
        setTranslationState({ status: 'error', message: 'No translation returned.' });
        return;
      }
      setTranslationState({ status: 'result', text, lang: targetLang });
    } catch {
      setTranslationState({ status: 'error', message: 'Could not connect to the server.' });
    }
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
          language,
        }),
      });

      const data: unknown = await res.json();

      if (res.status === 422) {
        setPageState({ status: 'idle' });
        setSpellingError('Word not found in dictionary. Check the spelling and try again.');
        return;
      }

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

  const t = UI[language];

  // ── Loading ──────────────────────────────────────────────────────────────
  if (pageState.status === 'loading') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-5 h-5 border-2 border-line border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-ink-muted">{t.analyzing}</p>
        </div>
      </div>
    );
  }

  // ── Result ───────────────────────────────────────────────────────────────
  if (pageState.status === 'result') {
    return <AnalysisResult record={pageState.record} onReset={handleReset} />;
  }

  // ── Settings button + panel (shared by idle & error) ─────────────────────
  const settingsButton = (
    <div ref={settingsRef} className="fixed top-4 right-4 z-50">
      <button
        onClick={() => setSettingsOpen((v) => !v)}
        className="p-1.5 text-ink-faint hover:text-ink transition-colors duration-150"
        aria-label="Settings"
      >
        <IconGear />
      </button>

      {settingsOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            background: '#FFFFFF',
            border: '1px solid #EAEAE6',
            borderRadius: '12px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            padding: '16px',
            minWidth: '192px',
            zIndex: 50,
          }}
        >
          {/* Language */}
          <div className="mb-4">
            <p
              className="mb-2 text-[0.7rem] font-semibold uppercase"
              style={{ color: '#3A3D8F', letterSpacing: '0.05em' }}
            >
              {t.langLabel}
            </p>
            <div className="flex gap-1.5">
              {(['en', 'es'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => { setLanguage(lang); setSettingsOpen(false); }}
                  className={`px-3 py-1 rounded-[6px] text-xs font-medium border transition-all duration-150 ${
                    language === lang
                      ? 'bg-accent text-white border-accent'
                      : 'bg-bg text-ink-muted border-line hover:text-ink hover:border-ink-muted'
                  }`}
                >
                  {lang === 'en' ? 'English' : 'Español'}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div className="flex items-center justify-between gap-4">
            <p
              className="text-[0.7rem] font-semibold uppercase"
              style={{ color: '#3A3D8F', letterSpacing: '0.05em' }}
            >
              {t.themeLabel}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-muted">
                {theme === 'light' ? t.light : t.dark}
              </span>
              <button
                onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
                className="relative flex-shrink-0 flex items-center rounded-full border border-line transition-colors duration-200"
                style={{
                  width: '36px',
                  height: '20px',
                  background: theme === 'dark' ? '#3A3D8F' : '#F0F0EE',
                  borderColor: theme === 'dark' ? '#3A3D8F' : '#EAEAE6',
                }}
                aria-label="Toggle theme"
              >
                <span
                  className="absolute rounded-full bg-white shadow-sm transition-transform duration-200"
                  style={{
                    width: '14px',
                    height: '14px',
                    transform: theme === 'dark' ? 'translateX(19px)' : 'translateX(3px)',
                  }}
                />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── Error ────────────────────────────────────────────────────────────────
  if (pageState.status === 'error') {
    return (
      <>
        {settingsButton}
        <div className="min-h-screen bg-bg flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <p className="text-sm text-ink mb-1">{t.errorTitle}</p>
            <p className="text-sm text-ink-muted mb-6">{pageState.message}</p>
            <button
              onClick={handleReset}
              className="text-sm text-accent hover:text-accent-hover transition-colors duration-150"
            >
              {t.tryAgain}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ── Idle ─────────────────────────────────────────────────────────────────
  return (
    <>
      {settingsButton}
      <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-16">

        {/* Brand */}
        <div className="text-center mb-10">
          <h1
            className="text-[2.75rem] tracking-tight text-ink leading-none"
            style={{ fontFamily: 'var(--font-dm-serif)', fontStyle: 'italic' }}
          >
            Empire
          </h1>
          <p className="mt-2.5 text-sm font-medium" style={{ letterSpacing: '0.12em', color: '#3A3D8F' }}>
            {t.tagline}
          </p>
        </div>

        {/* Curiosity */}
        <div
          className={`w-full max-w-[600px] mb-5 transition-opacity duration-500 ${
            curiosityVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-accent mb-1.5">
            {t.insightLabel}
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
              placeholder={t.placeholder}
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              className="w-full bg-transparent text-[1.5rem] font-medium text-ink placeholder:text-ink-faint outline-none border-b-2 border-line focus:border-accent transition-colors duration-200 pb-1"
            />
            {word.length >= 25 && (
              <p
                className="text-right text-[10px] mt-0.5"
                style={{ color: word.length === 40 ? '#E53935' : undefined }}
              >
                <span className={word.length < 40 ? 'text-ink-faint' : ''}>
                  {word.length}/40
                </span>
              </p>
            )}
            {spellingError && (
              <p style={{ color: '#E53935', fontSize: '0.75rem', marginTop: '4px', animation: 'fadeIn 0.25s ease' }}>
                {spellingError}
              </p>
            )}
          </div>

          {/* Inline translator */}
          {canAnalyze && (
            <div className="px-7 pb-5 border-t border-line pt-4">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5 flex-wrap flex-1">
                  {TRANSLATE_LANGS.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setTargetLang(l.id)}
                      className={`px-2.5 py-1 rounded-[6px] text-xs font-medium border transition-all duration-150 ${
                        targetLang === l.id
                          ? 'bg-accent text-white border-accent'
                          : 'bg-bg text-ink-muted border-line hover:text-ink hover:border-ink-muted'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleTranslate}
                  disabled={translationState.status === 'loading'}
                  className="shrink-0 px-3 py-1 rounded-[6px] text-xs font-medium border border-line text-ink-muted hover:text-ink hover:border-ink-muted transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {translationState.status === 'loading' ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border border-line border-t-accent rounded-full animate-spin" />
                      {t.translating}
                    </span>
                  ) : t.translate}
                </button>
              </div>

              {translationState.status === 'result' && (
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[1.5rem] font-bold tracking-tight leading-none" style={{ color: '#1A1A1A' }}>
                      {translationState.text}
                    </p>
                    <p
                      className="mt-1.5 text-[0.65rem] font-semibold uppercase"
                      style={{ color: '#9A9A96', letterSpacing: '0.08em' }}
                    >
                      {TRANSLATE_LANGS.find((l) => l.id === translationState.lang)?.label}
                    </p>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText((translationState as { status: 'result'; text: string }).text)}
                    className="mt-1 shrink-0 text-ink-faint hover:text-ink transition-colors duration-150"
                    title="Copy"
                  >
                    <IconCopy />
                  </button>
                </div>
              )}

              {translationState.status === 'error' && (
                <p className="mt-3 text-xs" style={{ color: '#B91C1C' }}>
                  {translationState.message}
                </p>
              )}
            </div>
          )}

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
                {showContext ? t.hideContext : t.addContext}
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
                    placeholder={t.contextHint}
                    rows={3}
                    className="mt-3 w-full bg-bg border border-line rounded-lg px-4 py-3 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent resize-none transition-colors duration-150"
                  />
                </div>
              </div>
            </div>

            {/* Tone selector */}
            <div className="flex flex-wrap gap-1.5">
              {TONES.map((tone_opt, i) => (
                <button
                  key={tone_opt.id}
                  onClick={() => setTone(tone_opt.id)}
                  className={`px-3 py-1 rounded-[6px] text-xs font-medium border transition-all duration-150 ${
                    tone === tone_opt.id
                      ? 'bg-accent text-white border-accent'
                      : 'bg-bg text-ink-muted border-line hover:text-ink hover:border-ink-muted'
                  }`}
                >
                  {t.toneLabels[i]}
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
              {t.analyze}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
