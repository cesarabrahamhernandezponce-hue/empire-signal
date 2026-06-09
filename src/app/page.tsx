'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import AnalysisResult, { type AnalyzeRecord } from '@/components/AnalysisResult';
import { track } from '@/lib/analytics';
import { createClient } from '@/lib/supabase/client';

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
    langLabel:       'Language',
    themeLabel:      'Theme',
    light:           'Light',
    dark:            'Dark',
    howToUse:        'How to use Empire Signal',
    howToUseTitle:   'What you can do',
    close:           'Close',
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
    langLabel:       'Idioma',
    themeLabel:      'Tema',
    light:           'Claro',
    dark:            'Oscuro',
    howToUse:        'Cómo usar Empire Signal',
    howToUseTitle:   'Qué puedes hacer',
    close:           'Cerrar',
  },
} as const;

const TRANSLATE_LANGS = [
  { id: 'fr', label: 'French'             },
  { id: 'de', label: 'German'             },
  { id: 'pt', label: 'Portuguese'         },
  { id: 'it', label: 'Italian'            },
  { id: 'ru', label: 'Russian'            },
  { id: 'ja', label: 'Japanese'           },
  { id: 'zh', label: 'Chinese (Simplified)' },
  { id: 'ar', label: 'Arabic'             },
  { id: 'ko', label: 'Korean'             },
  { id: 'hi', label: 'Hindi'              },
  { id: 'nl', label: 'Dutch'              },
  { id: 'pl', label: 'Polish'             },
  { id: 'tr', label: 'Turkish'            },
  { id: 'sv', label: 'Swedish'            },
  { id: 'uk', label: 'Ukrainian'          },
] as const;

type TranslateLang = (typeof TRANSLATE_LANGS)[number]['id'];

type TranslationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; text: string; lang: TranslateLang }
  | { status: 'error'; message: string };

type Language = 'en' | 'es';

type PageState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; record: AnalyzeRecord; cacheHit: boolean }
  | { status: 'error'; message: string; rateLimited?: boolean };

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

const FEATURES = [
  {
    title: 'Deep word analysis',
    body: 'Type any word — like "ephemeral" — and get etymology, CEFR level, collocations, mnemonic, usage examples, and more.',
  },
  {
    title: 'Personal context',
    body: 'Add the sentence where you found the word and receive a note specific to that exact usage.',
  },
  {
    title: 'Sentence validator',
    body: 'Write your own sentence using the word, get a score from 0 to 100, and a corrected version if needed.',
  },
  {
    title: 'Follow-up questions',
    body: 'After the analysis, ask anything about the word directly from the results page.',
  },
];

function IconClose() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function HelpModal({ title, onClose }: { title: string; onClose: () => void }) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.30)' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#FAFAF8', borderRadius: '16px', border: '1px solid #EAEAE6', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '28px 32px', maxWidth: '480px', width: '100%', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#3A3D8F' }}>
            {title}
          </p>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A9A96', padding: '2px', display: 'flex', alignItems: 'center' }}
            aria-label="Close"
          >
            <IconClose />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: '14px' }}>
              <span
                style={{ flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%', background: '#EEF0FF', color: '#3A3D8F', fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px' }}
              >
                {i + 1}
              </span>
              <div>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1A1A1A', marginBottom: '3px' }}>
                  {f.title}
                </p>
                <p style={{ fontSize: '0.8rem', color: '#6B6B67', lineHeight: 1.6 }}>
                  {f.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [user, setUser]                         = useState<User | null | undefined>(undefined);
  const [word, setWord]                         = useState('');
  const [context, setContext]                   = useState('');
  const [showContext, setShowContext]           = useState(false);
  const [language, setLanguage]                 = useState<Language>('en');
  const [theme, setTheme]                       = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') ?? 'light';
    }
    return 'light';
  });
  const [settingsOpen, setSettingsOpen]         = useState(false);
  const [curiosity, setCuriosity]               = useState(CURIOSITIES.en[0]);
  const [curiosityVisible, setCuriosityVisible] = useState(true);
  const [pageState, setPageState]               = useState<PageState>({ status: 'idle' });
  const [spellingError, setSpellingError]       = useState<string | null>(null);
  const [spellingSuggestion, setSpellingSuggestion] = useState<string | null>(null);
  const [history, setHistory]                   = useState<AnalyzeRecord[]>([]);
  const [sessionHistory, setSessionHistory]     = useState<string[]>([]);
  const [showHelp, setShowHelp]                   = useState(false);
  const [waitlistEmail, setWaitlistEmail]         = useState('');
  const [waitlistStatus, setWaitlistStatus]       = useState<'idle' | 'loading' | 'success' | 'duplicate'>('idle');
  const [translateExpanded, setTranslateExpanded] = useState(false);
  const [targetLang, setTargetLang]               = useState<TranslateLang | null>(null);
  const [translationState, setTranslationState]   = useState<TranslationState>({ status: 'idle' });
  const settingsRef                             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setUser(null); return; }
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

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
    setTranslateExpanded(false);
    setTargetLang(null);
    setTranslationState({ status: 'idle' });
    setSpellingError(null);
    setSpellingSuggestion(null);
  };

  const handleTranslate = async (lang: TranslateLang) => {
    const trimmed = word.trim();
    if (!trimmed) return;
    setTargetLang(lang);
    setTranslationState({ status: 'loading' });
    track('translation_requested', { targetLanguage: lang });
    try {
      const res = await fetch('/api/signal/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: trimmed, targetLanguages: [lang] }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        setTranslationState({ status: 'error', message: (data as { error?: string }).error ?? 'Translation failed.' });
        return;
      }
      const translations = (data as { translations: Record<string, string> }).translations;
      const text = translations[lang];
      if (!text) {
        setTranslationState({ status: 'error', message: 'No translation returned.' });
        return;
      }
      setTranslationState({ status: 'result', text, lang });
    } catch {
      setTranslationState({ status: 'error', message: 'Could not connect to the server.' });
    }
  };

  const handleAnalyzeWithWord = async (w: string) => {
    const trimmed = w.trim();
    if (!trimmed) return;

    setPageState({ status: 'loading' });

    try {
      const res = await fetch('/api/signal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: trimmed,
          context: context.trim() || null,
          language,
        }),
      });

      const data: unknown = await res.json();

      if (res.status === 422) {
        setPageState({ status: 'idle' });
        setSpellingError((data as { error?: string }).error ?? 'Word not found. Check the spelling and try again.');
        const suggestion = (data as { suggestion?: string | null }).suggestion ?? null;
        setSpellingSuggestion(suggestion);
        return;
      }

      if (res.status === 429) {
        track('rate_limit_hit', { word: trimmed });
        setPageState({ status: 'error', message: (data as { error?: string }).error ?? 'Daily limit reached.', rateLimited: true });
        return;
      }

      if (!res.ok) {
        const message = (data as { error?: string }).error ?? 'Unknown server error.';
        setPageState({ status: 'error', message });
        return;
      }

      const record = (data as { record: AnalyzeRecord }).record;
      const cacheHit = (data as { cacheHit?: boolean }).cacheHit ?? false;
      track('word_analyzed', { word: record.word, language, cacheHit });
      setPageState({ status: 'result', record, cacheHit });
      setSessionHistory((prev) => {
        const filtered = prev.filter((w) => w !== record.word);
        return [record.word, ...filtered].slice(0, 5);
      });
    } catch {
      setPageState({ status: 'error', message: 'Could not connect to the server. Check your connection.' });
    }
  };

  const handleAnalyze = () => handleAnalyzeWithWord(word);

  const handleSignOut = async () => {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.refresh();
  };

  const handleReset = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setPageState({ status: 'result', record: prev, cacheHit: true });
    } else {
      setWord('');
      setCuriosityVisible(true);
      setTranslateExpanded(false);
      setTargetLang(null);
      setTranslationState({ status: 'idle' });
      setSpellingError(null);
      setSpellingSuggestion(null);
      setWaitlistEmail('');
      setWaitlistStatus('idle');
      setPageState({ status: 'idle' });
    }
  };

  const handleWaitlist = async () => {
    const trimmed = waitlistEmail.trim();
    if (!trimmed) return;
    setWaitlistStatus('loading');
    try {
      const res = await fetch('/api/signal/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      if (res.status === 409) { setWaitlistStatus('duplicate'); return; }
      if (!res.ok) { setWaitlistStatus('idle'); return; }
      track('waitlist_signup', {});
      setWaitlistStatus('success');
    } catch {
      setWaitlistStatus('idle');
    }
  };

  const canAnalyze = word.trim().length > 0;

  const t = UI[language];

  // ── Auth bar (top-left, shared by all states) ────────────────────────────
  const authBar = user !== undefined && (
    <div className="fixed top-4 left-4 z-50">
      {user === null ? (
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-xs text-ink-muted hover:text-ink transition-colors duration-150">
            Log in
          </Link>
          <Link
            href="/auth/signup"
            className="text-xs px-3 py-1 rounded-[6px] border border-line text-ink-muted hover:text-ink hover:border-ink-muted transition-all duration-150"
          >
            Sign up
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-faint hidden sm:inline">{user.email}</span>
          <button
            onClick={handleSignOut}
            className="text-xs text-ink-muted hover:text-ink transition-colors duration-150"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );

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

  // ── Loading ──────────────────────────────────────────────────────────────
  if (pageState.status === 'loading') {
    return (
      <>
        {authBar}
        <div className="min-h-screen bg-bg flex items-center justify-center">
          <div className="text-center">
            <div className="w-5 h-5 border-2 border-line border-t-accent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-ink-muted">{t.analyzing}</p>
          </div>
        </div>
      </>
    );
  }

  // ── Result ───────────────────────────────────────────────────────────────
  if (pageState.status === 'result') {
    const currentRecord = pageState.record;
    return (
      <>
        {authBar}
        <AnalysisResult
          key={currentRecord.id}
          record={currentRecord}
          cacheHit={pageState.cacheHit}
          onReset={handleReset}
          onAnalyzeWord={(w) => {
            setHistory((h) => [...h, currentRecord]);
            setWord(w);
            handleAnalyzeWithWord(w);
          }}
        />
      </>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (pageState.status === 'error') {
    return (
      <>
        {authBar}
        {settingsButton}
        <div className="min-h-screen bg-bg flex items-center justify-center px-4">
          <div className="max-w-sm w-full">
            {pageState.rateLimited ? (
              <div className="text-center">
                <p className="text-sm font-medium text-ink mb-1">{"You've reached today's limit"}</p>
                <p className="text-xs text-ink-muted mb-6 leading-relaxed">
                  Come back tomorrow, or leave your email to be notified when accounts launch.
                </p>
                {waitlistStatus === 'success' ? (
                  <p className="text-sm text-ink-muted">{"You're on the list."}</p>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); handleWaitlist(); }} className="flex flex-col gap-2">
                    <input
                      type="email"
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full bg-bg border border-line rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent transition-colors duration-150"
                    />
                    {waitlistStatus === 'duplicate' && (
                      <p className="text-xs text-ink-muted text-left">Already on the list.</p>
                    )}
                    <button
                      type="submit"
                      disabled={waitlistStatus === 'loading' || waitlistEmail.trim().length === 0}
                      className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-accent hover:bg-accent-hover transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {waitlistStatus === 'loading' ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                          Sending...
                        </span>
                      ) : 'Notify me when accounts launch'}
                    </button>
                  </form>
                )}
                <button
                  onClick={handleReset}
                  className="mt-5 text-xs text-ink-faint hover:text-ink-muted transition-colors duration-150"
                >
                  {t.tryAgain}
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-ink mb-1">{t.errorTitle}</p>
                <p className="text-sm text-ink-muted mb-6">{pageState.message}</p>
                <button
                  onClick={handleReset}
                  className="text-sm text-accent hover:text-accent-hover transition-colors duration-150"
                >
                  {t.tryAgain}
                </button>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── Idle ─────────────────────────────────────────────────────────────────
  return (
    <>
      {authBar}
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

        {/* Session history chips */}
        {sessionHistory.length > 0 && word.length === 0 && (
          <div className="w-full max-w-[600px] mb-4">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-ink-faint mb-2">
              Recent
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {sessionHistory.map((w) => (
                <button
                  key={w}
                  onClick={() => {
                    setWord(w);
                    setCuriosityVisible(false);
                    handleAnalyzeWithWord(w);
                  }}
                  className="text-xs text-ink-muted border border-line bg-surface rounded-full hover:border-accent hover:text-accent transition-colors duration-150 px-3 py-1"
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}

        {showHelp && <HelpModal title={t.howToUseTitle} onClose={() => setShowHelp(false)} />}

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
              <div style={{ marginTop: '4px', animation: 'fadeIn 0.25s ease' }}>
                <p style={{ color: '#E53935', fontSize: '0.75rem' }}>{spellingError}</p>
                {spellingSuggestion && (
                  <button
                    onClick={() => {
                      setSpellingError(null);
                      setSpellingSuggestion(null);
                      setWord(spellingSuggestion);
                      handleAnalyzeWithWord(spellingSuggestion);
                    }}
                    style={{
                      color: '#3A3D8F',
                      fontSize: '0.75rem',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      marginTop: '2px',
                      display: 'block',
                    }}
                  >
                    Did you mean &ldquo;{spellingSuggestion}&rdquo;?
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Inline translator */}
          {canAnalyze && !spellingError && (
            <div className="px-7 pb-5 border-t border-line pt-4">
              <div className="flex items-center gap-2">
                {translateExpanded && (
                  <div className="flex gap-1.5 flex-wrap flex-1">
                    {TRANSLATE_LANGS.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => handleTranslate(l.id)}
                        disabled={translationState.status === 'loading'}
                        className={`px-2.5 py-1 rounded-[6px] text-xs font-medium border transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                          targetLang === l.id
                            ? 'bg-accent text-white border-accent'
                            : 'bg-bg text-ink-muted border-line hover:text-ink hover:border-ink-muted'
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => {
                    if (translateExpanded) {
                      setTranslateExpanded(false);
                      setTargetLang(null);
                      setTranslationState({ status: 'idle' });
                    } else {
                      setTranslateExpanded(true);
                    }
                  }}
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

        {/* How to use link */}
        <button
          onClick={() => setShowHelp(true)}
          className="mt-5 text-xs text-ink-faint hover:text-ink-muted transition-colors duration-150"
        >
          {t.howToUse}
        </button>

      </main>
    </>
  );
}
