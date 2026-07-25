'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import AnalysisResult, { type AnalyzeRecord } from '@/components/AnalysisResult';
import OnboardingModal from '@/components/OnboardingModal';
import { track } from '@/lib/analytics';
import { createClient } from '@/lib/supabase/client';
import { loadSessionHistory, addSessionHistory, removeSessionHistory, type SessionHistoryEntry } from '@/lib/session-history';

// A 503 from /analyze means every free AI provider was momentarily saturated.
// That clears in a second or two, so we silently retry before showing the
// error — confirmed to turn most transient failures into a normal result.
const ANALYZE_RETRY_DELAY_MS = 1500;
// How many times to re-fire the request after a 503 (all AI providers busy).
// Each retry only runs after an actual failure, so it costs quota only when the
// first attempt already came up empty.
const ANALYZE_MAX_503_RETRIES = 2;
// Per-attempt cap on the analyze fetch. Cold multi-word analyses on the free
// model routinely run 30-37s; the server allows up to 60s (route maxDuration),
// so cap the client just under that to avoid aborting slow-but-valid analyses.
const ANALYZE_TIMEOUT_MS = 55000;
// After this long in the loading view, swap the rotating decorative messages
// for a reassuring "this is taking longer than usual" note.
const LOADING_SLOW_AFTER_MS = 12000;

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
    insightLabel:        'Empire Insight',
    wordOfDayLabel:      'Word of the Day',
    wordOfDayCta:        'See full analysis →',
    tagline:             'Linguistic intelligence',
    headline:            'You know the word. But do you know how to use it?',
    subheadline:         'Empire Signal shows you the register, the collocations, and the context that turn vocabulary you recognize into vocabulary you can actually use.',
    placeholder:         'Type any word…',
    placeholderShort:    'Type a word…',
    exampleLabel:        'Try:',
    exampleWord:         'ephemeral',
    contextHint:         "e.g. I'm reading a 19th-century medical text...",
    addContext:          '+ Add context (optional)',
    hideContext:         '− Hide context',
    translate:           'Translate',
    translating:         'Translating',
    translateLimit:      "You've reached today's translation limit. Come back tomorrow.",
    translateError:      'Translation failed. Please try again.',
    analyze:             'Analyze',
    analyzing:           'Analyzing...',
    analyzingSlow:       'This is taking a bit longer than usual — still working on it…',
    timeoutError:        'This took too long. The server may be busy — please try again.',
    errorTitle:          'Something went wrong',
    tryAgain:            '← Try again',
    themeLabel:          'Theme',
    light:               'Light',
    dark:                'Dark',
    howToUse:            'How to use Empire Signal',
    lensLink:            'Have a full text? Analyze it with',
    howToUseTitle:       'What you can do',
    close:               'Close',
    recent:              'Recent',
    viewAll:             'View all →',
    deleteHistoryConfirm: 'Delete word from history?',
    deleteConfirm:       'Delete',
    cancel:              'Cancel',
    logIn:               'Log in',
    signUp:              'Sign up',
    logOut:              'Log out',
    rateLimitTitle:      "You've reached today's limit",
    anonLimitSub:        'Create a free account to keep going — registered users get 30 analyses every month.',
    createAccountBtn:    'Create a free account',
    haveAccountSignIn:   'Already have an account? Sign in',
    registeredLimitTitle:"You've reached this month's limit",
    registeredLimitSub:  "You've used all your analyses this month. Leave your email and we'll let you know when higher limits are available.",
    waitlistPlaceholder: 'you@example.com',
    alreadyOnList:       'Already on the list.',
    notifyBtn:           'Notify me about higher limits',
    sending:             'Sending...',
    onTheList:           "You're on the list.",
    didYouMean:          'Did you mean',
    otherLangCta:        'Analyze in Spanish instead',
    analyzeAnyway:       'Analyze anyway',
    loadingMessages:     [
      'Consulting etymology archives...',
      'Mapping collocations...',
      'Checking register levels...',
      'Finding usage examples...',
      'Analyzing common errors...',
    ],
  },
  es: {
    insightLabel:        'Perspectiva Empire',
    wordOfDayLabel:      'Palabra del día',
    wordOfDayCta:        'Ver análisis completo →',
    tagline:             'Inteligencia lingüística',
    headline:            'Conoces la palabra. ¿Pero sabes cómo usarla?',
    subheadline:         'Empire Signal te muestra el registro, las colocaciones y el contexto que convierten el vocabulario que reconoces en vocabulario que de verdad puedes usar.',
    placeholder:         'Escribe cualquier palabra…',
    placeholderShort:    'Escribe una palabra…',
    exampleLabel:        'Prueba:',
    exampleWord:         'efímero',
    contextHint:         'ej. Estoy leyendo un texto médico del siglo XIX...',
    addContext:          '+ Agregar contexto (opcional)',
    hideContext:         '− Ocultar contexto',
    translate:           'Traducir',
    translating:         'Traduciendo',
    translateLimit:      'Alcanzaste el límite de traducciones de hoy. Vuelve mañana.',
    translateError:      'No se pudo traducir. Inténtalo de nuevo.',
    analyze:             'Analizar',
    analyzing:           'Analizando...',
    analyzingSlow:       'Esto está tardando un poco más de lo normal — seguimos trabajando…',
    timeoutError:        'Tardó demasiado. El servidor puede estar ocupado — inténtalo de nuevo.',
    errorTitle:          'Algo salió mal',
    tryAgain:            '← Intentar de nuevo',
    themeLabel:          'Tema',
    light:               'Claro',
    dark:                'Oscuro',
    howToUse:            'Cómo usar Empire Signal',
    lensLink:            '¿Tienes un texto completo? Analízalo con',
    howToUseTitle:       'Qué puedes hacer',
    close:               'Cerrar',
    recent:              'Recientes',
    viewAll:             'Ver todo →',
    deleteHistoryConfirm: '¿Eliminar palabra del historial?',
    deleteConfirm:       'Eliminar',
    cancel:              'Cancelar',
    logIn:               'Iniciar sesión',
    signUp:              'Registrarse',
    logOut:              'Cerrar sesión',
    rateLimitTitle:      'Alcanzaste el límite de hoy',
    anonLimitSub:        'Crea una cuenta gratis para seguir — los usuarios registrados tienen 30 análisis cada mes.',
    createAccountBtn:    'Crear una cuenta gratis',
    haveAccountSignIn:   '¿Ya tienes cuenta? Inicia sesión',
    registeredLimitTitle:'Alcanzaste el límite de este mes',
    registeredLimitSub:  'Usaste todos tus análisis este mes. Deja tu email y te avisaremos cuando haya límites más altos.',
    waitlistPlaceholder: 'tu@correo.com',
    alreadyOnList:       'Ya estás en la lista.',
    notifyBtn:           'Avisarme sobre límites más altos',
    sending:             'Enviando...',
    onTheList:           '¡Ya estás en la lista!',
    didYouMean:          '¿Quisiste decir',
    otherLangCta:        'Analizar en inglés',
    analyzeAnyway:       'Analizar de todos modos',
    loadingMessages:     [
      'Consultando archivos etimológicos...',
      'Mapeando colocaciones...',
      'Comprobando niveles de registro...',
      'Buscando ejemplos de uso...',
      'Analizando errores comunes...',
    ],
  },
} as const;

const TRANSLATE_LANGS = [
  { id: 'es', label: 'Spanish'              },
  { id: 'fr', label: 'French'               },
  { id: 'pt', label: 'Portuguese'           },
  { id: 'it', label: 'Italian'              },
  { id: 'de', label: 'German'               },
  { id: 'ru', label: 'Russian'              },
  { id: 'ja', label: 'Japanese'             },
  { id: 'zh', label: 'Chinese (Simplified)' },
  { id: 'ar', label: 'Arabic'               },
  { id: 'ko', label: 'Korean'               },
  { id: 'nl', label: 'Dutch'                },
  { id: 'pl', label: 'Polish'               },
  { id: 'tr', label: 'Turkish'              },
  { id: 'sv', label: 'Swedish'              },
  { id: 'uk', label: 'Ukrainian'            },
] as const;

type TranslateLang = (typeof TRANSLATE_LANGS)[number]['id'];

type TranslationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; translations: { lang: TranslateLang; text: string }[] }
  | { status: 'error'; message: string };

type Language = 'en' | 'es';

type PageState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; record: AnalyzeRecord; cacheHit: boolean }
  | { status: 'error'; message: string; rateLimited?: boolean; tier?: 'anonymous' | 'registered' };

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

function IconHelp() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M6.3 6.1c0-1 .8-1.6 1.7-1.6.9 0 1.6.6 1.6 1.5 0 .8-.5 1.1-1.1 1.5-.5.3-.7.6-.7 1.2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="8" cy="11.2" r="0.7" fill="currentColor" />
    </svg>
  );
}

const BRAND_GRADIENT = 'linear-gradient(90deg, #3A3D8F 0%, #5B5FCF 100%)';

const FEATURES: Record<'en' | 'es', { title: string; body: string }[]> = {
  en: [
    {
      title: 'Deep word analysis',
      body: 'Type any word — like "ephemeral" — and get etymology, CEFR level, collocations, usage examples, and more.',
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
  ],
  es: [
    {
      title: 'Análisis profundo de palabras',
      body: 'Escribe cualquier palabra —como "efímero"— y obtén etimología, nivel CEFR, colocaciones, ejemplos de uso y más.',
    },
    {
      title: 'Contexto personal',
      body: 'Añade la oración donde encontraste la palabra y recibe una nota específica para ese uso exacto.',
    },
    {
      title: 'Validador de oraciones',
      body: 'Escribe tu propia oración con la palabra, obtén una puntuación del 0 al 100 y una versión corregida si la necesitas.',
    },
    {
      title: 'Preguntas de seguimiento',
      body: 'Después del análisis, pregunta lo que quieras sobre la palabra directamente desde los resultados.',
    },
  ],
};

function IconClose() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function HelpModal({ title, language, onClose }: { title: string; language: 'en' | 'es'; onClose: () => void }) {
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
        style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '28px 32px', maxWidth: '480px', width: '100%', position: 'relative' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)' }}>
            {title}
          </p>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', padding: '2px', display: 'flex', alignItems: 'center' }}
            aria-label="Close"
          >
            <IconClose />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {FEATURES[language].map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: '14px' }}>
              <span
                style={{ flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%', background: 'var(--badge-bg)', color: 'var(--accent)', fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px' }}
              >
                {i + 1}
              </span>
              <div>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>
                  {f.title}
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
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

function LoadingView({ word, messages, srLabel, slowMessage }: { word: string; messages: readonly string[]; srLabel: string; slowMessage: string }) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  const [slow, setSlow] = useState(false);

  // Decorative rotation only — these messages advance on a fixed 2s timer and
  // do not reflect real analysis progress (the AI can't report it). Once we
  // cross the slow threshold we stop rotating and hold a reassuring message so
  // a long generation never looks frozen. The view unmounts the moment the
  // result arrives, so the result is never delayed.
  useEffect(() => {
    const slowTimer = setTimeout(() => {
      setSlow(true);
      setVisible(true);
    }, LOADING_SLOW_AFTER_MS);
    return () => clearTimeout(slowTimer);
  }, []);

  useEffect(() => {
    if (slow) return;
    let fadeTimer: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setVisible(false);
      fadeTimer = setTimeout(() => {
        setMsgIdx((i) => (i + 1) % messages.length);
        setVisible(true);
      }, 350);
    }, 2000);
    return () => {
      clearInterval(id);
      clearTimeout(fadeTimer);
    };
  }, [messages.length, slow]);

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <div className="mb-10 text-center">
          <h1
            className="text-[3.25rem] sm:text-[3.75rem] tracking-tight text-ink leading-none"
            style={{ fontFamily: 'var(--font-dm-serif)' }}
          >
            {word}
          </h1>
        </div>

        <div className="flex flex-col gap-4">
          {([96, 72, 112] as const).map((h, i) => (
            <div
              key={i}
              className="motion-safe:animate-pulse rounded-[12px] border border-line p-6"
              style={{ background: 'var(--surface)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <div className="rounded-md" style={{ background: 'var(--surface-muted)', height: h }} />
            </div>
          ))}
        </div>

        {/* Indicator stacked above the text so the message changing width never
            shifts the indicator sideways. Ring spinner when motion is allowed;
            a calmer opacity-pulse dot under prefers-reduced-motion (CSS-only
            swap that reacts live to the OS setting, no JS). */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <span
            className="w-3.5 h-3.5 border-2 border-line border-t-accent rounded-full animate-spin shrink-0 motion-reduce:hidden"
            aria-hidden
          />
          <span
            className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse shrink-0 hidden motion-reduce:block"
            aria-hidden
          />
          <p
            aria-hidden
            className="text-center text-sm text-ink-muted min-h-[1.25rem]"
            style={{ transition: 'opacity 350ms ease', opacity: visible ? 1 : 0 }}
          >
            {slow ? slowMessage : messages[msgIdx]}
          </p>
          {/* Single static announcement for screen readers — the rotating
              messages above are decorative and would otherwise spam the
              live region every 2s. */}
          <span role="status" className="sr-only">{srLabel}</span>
        </div>
      </div>
    </div>
  );
}

function dedupeEntries(entries: SessionHistoryEntry[]): SessionHistoryEntry[] {
  const seen = new Set<string>();
  const out: SessionHistoryEntry[] = [];
  for (const e of entries) {
    const key = e.word.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

export default function Home() {
  const router = useRouter();
  const [user, setUser]                         = useState<User | null | undefined>(undefined);
  const [word, setWord]                         = useState('');
  const [context, setContext]                   = useState('');
  const [showContext, setShowContext]           = useState(false);
  const [language, setLanguage]                 = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('language') as Language) ?? 'en';
    }
    return 'en';
  });
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
  const [spellingCanForce, setSpellingCanForce] = useState(false);
  const [history, setHistory]                   = useState<AnalyzeRecord[]>([]);
  const [sessionHistory, setSessionHistory]     = useState<SessionHistoryEntry[]>([]);
  const [pendingDelete, setPendingDelete]       = useState<SessionHistoryEntry | null>(null);
  const [showHelp, setShowHelp]                   = useState(false);
  const [waitlistEmail, setWaitlistEmail]         = useState('');
  const [waitlistStatus, setWaitlistStatus]       = useState<'idle' | 'loading' | 'success' | 'duplicate'>('idle');
  const [translateExpanded, setTranslateExpanded] = useState(false);
  const [selectedLangs, setSelectedLangs]         = useState<TranslateLang[]>([]);
  const [translationState, setTranslationState]   = useState<TranslationState>({ status: 'idle' });
  const [isDesktop, setIsDesktop]                 = useState(false);
  const [wordOfDay, setWordOfDay]                 = useState<{ word: string; record: AnalyzeRecord } | null>(null);
  const settingsRef                             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    // Resolves auth state by subscribing to an external system (Supabase); the
    // no-client branch sets the resolved "anonymous" state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!supabase) { setUser(null); return; }
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_OUT') {
        setPageState({ status: 'idle' });
        setSessionHistory([]);
        setHistory([]);
        setWord('');
        setContext('');
        setShowContext(false);
        setCuriosityVisible(true);
        setTranslateExpanded(false);
        setSelectedLangs([]);
        setTranslationState({ status: 'idle' });
        setSpellingError(null);
        setSpellingSuggestion(null);
        setSpellingCanForce(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch persistent history for authenticated users; falls back to session-only for anonymous.
  useEffect(() => {
    if (!user) return;  // null = anonymous, undefined = auth not yet resolved
    let active = true;
    fetch('/api/signal/history')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { history: Array<{ word: string; language: 'en' | 'es' }> } | null) => {
        if (active && data?.history) {
          setSessionHistory(dedupeEntries(data.history));
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [user]);

  // Anonymous users get a lightweight, client-only history from localStorage.
  // Logged-in users use the DB-backed history above; the two never mix.
  useEffect(() => {
    if (user !== null) return;  // undefined = unresolved, truthy = logged-in (DB history)
    const entries = loadSessionHistory();
    if (entries.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionHistory(dedupeEntries(entries));
  }, [user]);

  useEffect(() => {
    const pool = CURIOSITIES[language];
    // Random pick must happen client-side post-mount, otherwise the server and
    // client render different tips and hydration mismatches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCuriosity(pool[Math.floor(Math.random() * pool.length)]);
  }, [language]);

  // Word of the Day — deterministic per language, served pre-cached (no AI, no
  // rate-limit cost). Refetch when the language toggle changes.
  useEffect(() => {
    let active = true;
    // Clear immediately so a failed/empty fetch for the new language can never
    // leave the previous language's word on screen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWordOfDay(null);
    fetch(`/api/signal/word-of-day?language=${language}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { word?: string; record?: AnalyzeRecord } | null) => {
        if (active && data?.word && data.record) {
          setWordOfDay({ word: data.word, record: data.record });
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [language]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

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
    setSelectedLangs([]);
    setTranslationState({ status: 'idle' });
    setSpellingError(null);
    setSpellingSuggestion(null);
    setSpellingCanForce(false);
  };

  // Toggle a language in/out of the pending selection. Clears any shown
  // results so the displayed translations never contradict the chips.
  const toggleTranslateLang = (id: TranslateLang) => {
    setSelectedLangs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setTranslationState((s) => (s.status === 'idle' ? s : { status: 'idle' }));
  };

  // One batched request for every selected language — the endpoint accepts the
  // array and counts a single rate-limit event per call, so this respects the
  // durable translate limit instead of burning one unit per language.
  const handleTranslate = async () => {
    const trimmed = word.trim();
    if (!trimmed || selectedLangs.length === 0) return;
    const langs = selectedLangs;
    setTranslationState({ status: 'loading' });
    track('translation_requested', { targetLanguages: langs });
    try {
      const res = await fetch('/api/signal/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: trimmed, targetLanguages: langs }),
      });
      const data: unknown = await res.json();
      if (res.status === 429) {
        setTranslationState({ status: 'error', message: UI[language].translateLimit });
        return;
      }
      if (!res.ok) {
        setTranslationState({ status: 'error', message: UI[language].translateError });
        return;
      }
      const translations = (data as { translations?: Record<string, string> }).translations ?? {};
      // Render in the canonical TRANSLATE_LANGS order, not request/response order.
      const ordered = TRANSLATE_LANGS
        .filter((l) => langs.includes(l.id) && typeof translations[l.id] === 'string')
        .map((l) => ({ lang: l.id, text: translations[l.id] }));
      if (ordered.length === 0) {
        setTranslationState({ status: 'error', message: UI[language].translateError });
        return;
      }
      setTranslationState({ status: 'result', translations: ordered });
    } catch {
      setTranslationState({ status: 'error', message: UI[language].translateError });
    }
  };

  // Long-press on a history chip opens the delete confirmation instead of
  // running an analysis. A ref flag lets the click handler know a long-press
  // already fired so it doesn't also trigger the search on pointer release.
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const startHistoryLongPress = (entry: SessionHistoryEntry) => {
    longPressFired.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      setPendingDelete(entry);
    }, 500);
  };

  const cancelHistoryLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDeleteHistory = (entry: SessionHistoryEntry) => {
    setSessionHistory((prev) => prev.filter((e) => e.word !== entry.word));
    if (user === null) {
      removeSessionHistory(entry.word);
    } else if (user) {
      fetch('/api/signal/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: entry.word, language: entry.language }),
      }).catch(() => {});
    }
    setPendingDelete(null);
  };

  const handleAnalyzeWithWord = async (w: string, langOverride?: Language, force = false, attempt = 0) => {
    const trimmed = w.trim();
    if (!trimmed) return;

    const lang = langOverride ?? language;

    setPageState({ status: 'loading' });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);

    try {
      const res = await fetch('/api/signal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: trimmed,
          context: context.trim() || null,
          language: lang,
          force,
        }),
        signal: controller.signal,
      });

      const data: unknown = await res.json();

      if (res.status === 422) {
        setPageState({ status: 'idle' });
        setSpellingError((data as { error?: string }).error ?? "We couldn't verify this word.");
        const suggestion = (data as { suggestion?: string | null }).suggestion ?? null;
        setSpellingSuggestion(suggestion);
        setSpellingCanForce((data as { canForce?: boolean }).canForce ?? false);
        return;
      }

      if (res.status === 429) {
        const tier = (data as { tier?: 'anonymous' | 'registered' }).tier;
        track('rate_limit_hit', { word: trimmed, tier });
        setPageState({ status: 'error', message: (data as { error?: string }).error ?? 'Daily limit reached.', rateLimited: true, tier });
        return;
      }

      if (!res.ok) {
        // 503 = every AI provider was momentarily busy. On the free tier this is
        // a brief blip that clears within a second or two, so retry up to twice
        // (staying in the loading state) before surfacing the error.
        if (res.status === 503 && attempt < ANALYZE_MAX_503_RETRIES) {
          await new Promise((r) => setTimeout(r, ANALYZE_RETRY_DELAY_MS));
          return handleAnalyzeWithWord(w, langOverride, force, attempt + 1);
        }
        const message = (data as { error?: string }).error ?? 'Unknown server error.';
        setPageState({ status: 'error', message });
        return;
      }

      const record = (data as { record: AnalyzeRecord }).record;
      const cacheHit = (data as { cacheHit?: boolean }).cacheHit ?? false;
      track('word_analyzed', { word: record.word, language: lang, cacheHit });
      setPageState({ status: 'result', record, cacheHit });
      setSessionHistory((prev) => {
        const filtered = prev.filter((e) => e.word !== record.word);
        return [{ word: record.word, language: lang }, ...filtered].slice(0, 20);
      });
      // Persist only the lightweight session history for anonymous users;
      // registered users are covered by the DB history and must not be mixed in.
      if (user === null) {
        addSessionHistory(record.word, lang);
      }
    } catch (err) {
      // A timeout (abort) usually means the AI tier was momentarily slow rather
      // than a real failure — retry once like a 503 before surfacing the error.
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (attempt === 0) {
          clearTimeout(timeoutId);
          return handleAnalyzeWithWord(w, langOverride, force, attempt + 1);
        }
        setPageState({ status: 'error', message: UI[lang].timeoutError });
        return;
      }
      setPageState({ status: 'error', message: 'Could not connect to the server. Check your connection.' });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const handleAnalyze = () => handleAnalyzeWithWord(word);

  // First-visit onboarding CTA: reuses the same analysis path as the "Try:
  // ephemeral" chip. Forced to EN because "ephemeral" is the cached English
  // sample, so it never spends AI budget.
  const handleOnboardingExample = () => {
    setWord('ephemeral');
    setCuriosityVisible(false);
    track('onboarding_example_clicked', { word: 'ephemeral' });
    handleAnalyzeWithWord('ephemeral', 'en');
  };

  // Deep-link pickup for Empire Lens: a "?w=<word>&lang=<en|es>" link (used by
  // the Lens word-suggestion panel's "Analyze in Empire" action) prefills the
  // word and runs the normal analyze flow once on mount. The query string is
  // cleared afterward so a refresh doesn't re-trigger it.
  const didLensPickup = useRef(false);
  useEffect(() => {
    if (didLensPickup.current) return;
    didLensPickup.current = true;
    try {
      const params = new URLSearchParams(window.location.search);
      const w = params.get('w');
      if (!w) return;
      const lp = params.get('lang');
      const lang: Language | undefined = lp === 'es' || lp === 'en' ? lp : undefined;
      // Prefill from a trusted deep link and kick off the normal analyze flow.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (lang) setLanguage(lang);
      setWord(w);
      window.history.replaceState(null, '', window.location.pathname);
      void handleAnalyzeWithWord(w, lang);
    } catch { /* ignore malformed query */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open the pre-cached Word of the Day as a normal result — no network round
  // trip (the record is already loaded) and no metered analyze call.
  const handleOpenWordOfDay = () => {
    if (!wordOfDay) return;
    track('word_of_day_opened', { word: wordOfDay.word, language });
    setPageState({ status: 'result', record: wordOfDay.record, cacheHit: true });
  };

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
      setSelectedLangs([]);
      setTranslationState({ status: 'idle' });
      setSpellingError(null);
      setSpellingSuggestion(null);
      setSpellingCanForce(false);
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
            {t.logIn}
          </Link>
          <Link
            href="/auth/signup"
            className="text-xs px-3 py-1 rounded-[6px] border border-line text-ink-muted hover:text-ink hover:border-ink-muted transition-all duration-150"
          >
            {t.signUp}
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-faint hidden sm:inline">{user.email}</span>
          <button
            onClick={handleSignOut}
            className="text-xs text-ink-muted hover:text-ink transition-colors duration-150"
          >
            {t.logOut}
          </button>
        </div>
      )}
    </div>
  );

  // ── Settings button + panel ───────────────────────────────────────────────
  // The gear button and dropdown are identical wherever settings appear; only the
  // wrapper position differs (fixed corner on error, inline in the idle toolbar).
  // Defining them once keeps the two placements from drifting apart.
  const settingsGearButton = (
    <button
      onClick={() => setSettingsOpen((v) => !v)}
      className="p-1.5 text-ink-faint hover:text-ink transition-colors duration-150"
      aria-label="Settings"
    >
      <IconGear />
    </button>
  );

  const settingsPanel = settingsOpen && (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        right: 0,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        padding: '16px',
        minWidth: '192px',
        zIndex: 50,
      }}
    >
      {/* Theme */}
      <div className="flex items-center justify-between gap-4">
        <p
          className="text-[0.7rem] font-semibold uppercase"
          style={{ color: 'var(--accent)', letterSpacing: '0.05em' }}
        >
          {t.themeLabel}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-ink-muted">
            {theme === 'light' ? t.light : t.dark}
          </span>
          <button
            onClick={() => setTheme((tv) => (tv === 'light' ? 'dark' : 'light'))}
            className="relative flex-shrink-0 flex items-center rounded-full border border-line transition-colors duration-200"
            style={{
              width: '36px',
              height: '20px',
              background: theme === 'dark' ? 'var(--accent)' : 'var(--surface-muted)',
              borderColor: theme === 'dark' ? 'var(--accent)' : 'var(--border)',
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
  );

  // Corner placement used by the error state.
  const settingsButton = (
    <div ref={settingsRef} className="fixed top-4 right-4 z-50">
      {settingsGearButton}
      {settingsPanel}
    </div>
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (pageState.status === 'loading') {
    return <LoadingView word={word} messages={t.loadingMessages} srLabel={t.analyzing} slowMessage={t.analyzingSlow} />;
  }

  // ── Result ───────────────────────────────────────────────────────────────
  if (pageState.status === 'result') {
    const currentRecord = pageState.record;
    return (
      <>
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
          user={user}
          onSignOut={handleSignOut}
          hasHistory={history.length > 0}
          uiLang={language}
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
            {pageState.rateLimited && pageState.tier !== 'registered' ? (
              <div className="text-center">
                <p className="text-sm font-medium text-ink mb-1">{t.rateLimitTitle}</p>
                <p className="text-xs text-ink-muted mb-6 leading-relaxed">
                  {t.anonLimitSub}
                </p>
                <Link
                  href="/auth/signup"
                  className="block w-full py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 bg-accent text-white hover:bg-accent-hover"
                >
                  {t.createAccountBtn}
                </Link>
                <Link
                  href="/auth/login"
                  className="mt-3 inline-block text-xs text-ink-muted hover:text-ink transition-colors duration-150"
                >
                  {t.haveAccountSignIn}
                </Link>
                <button
                  onClick={handleReset}
                  className="mt-5 block mx-auto text-xs text-ink-faint hover:text-ink-muted transition-colors duration-150"
                >
                  {t.tryAgain}
                </button>
              </div>
            ) : pageState.rateLimited ? (
              <div className="text-center">
                <p className="text-sm font-medium text-ink mb-1">{t.registeredLimitTitle}</p>
                <p className="text-xs text-ink-muted mb-6 leading-relaxed">
                  {t.registeredLimitSub}
                </p>
                {waitlistStatus === 'success' ? (
                  <p className="text-sm text-ink-muted">{t.onTheList}</p>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); handleWaitlist(); }} className="flex flex-col gap-2">
                    <input
                      type="email"
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      placeholder={t.waitlistPlaceholder}
                      required
                      className="w-full bg-bg border border-line rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent transition-colors duration-150"
                    />
                    {waitlistStatus === 'duplicate' && (
                      <p className="text-xs text-ink-muted text-left">{t.alreadyOnList}</p>
                    )}
                    <button
                      type="submit"
                      disabled={waitlistStatus === 'loading' || waitlistEmail.trim().length === 0}
                      className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 bg-accent text-white enabled:hover:bg-accent-hover disabled:bg-[var(--surface-muted)] disabled:text-ink-faint disabled:cursor-not-allowed"
                    >
                      {waitlistStatus === 'loading' ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                          {t.sending}
                        </span>
                      ) : t.notifyBtn}
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
      {showHelp && <HelpModal title={t.howToUseTitle} language={language} onClose={() => setShowHelp(false)} />}

      <OnboardingModal user={user} onSeeExample={handleOnboardingExample} />

      {pendingDelete && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.30)' }}
          onClick={() => setPendingDelete(null)}
        >
          <div
            style={{ background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: '28px 32px', maxWidth: '360px', width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
              {t.deleteHistoryConfirm}
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '22px' }}>
              “{pendingDelete.word}”
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setPendingDelete(null)}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                {t.cancel}
              </button>
              <button
                onClick={() => handleDeleteHistory(pendingDelete)}
                style={{ background: 'var(--danger)', border: 'none', borderRadius: '10px', padding: '8px 16px', fontSize: '0.8rem', fontWeight: 600, color: '#fff', cursor: 'pointer' }}
              >
                {t.deleteConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="min-h-screen bg-bg flex flex-col items-center px-4 pt-4 pb-16">
        <div className="w-full max-w-[600px]">

          {/* Top bar — static, scrolls with content (no fixed-over-text overlap) */}
          <div className="flex items-center justify-between py-2 mb-4 sm:mb-8">
            <div className="flex items-center gap-3">
              {user === null && (
                <>
                  <Link href="/auth/login" className="text-xs text-ink-muted hover:text-ink transition-colors duration-150">
                    {t.logIn}
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="text-xs px-3 py-1 rounded-[6px] border border-line text-ink-muted hover:text-ink hover:border-ink-muted transition-all duration-150"
                  >
                    {t.signUp}
                  </Link>
                </>
              )}
              {user != null && (
                <>
                  <span className="text-xs text-ink-faint hidden sm:inline">{user.email}</span>
                  <button
                    onClick={handleSignOut}
                    className="text-xs text-ink-muted hover:text-ink transition-colors duration-150"
                  >
                    {t.logOut}
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowHelp(true)}
                className="p-1.5 text-ink-faint hover:text-accent transition-colors duration-150"
                aria-label={t.howToUse}
                title={t.howToUse}
              >
                <IconHelp />
              </button>
              <div ref={settingsRef} className="relative">
                {settingsGearButton}
                {settingsPanel}
              </div>
            </div>
          </div>

          {/* 1. Wordmark */}
          <div className="text-center mb-4">
            <span
              className="inline-block text-[1.4rem] sm:text-[1.6rem] tracking-tight leading-none"
              style={{
                fontFamily: 'var(--font-dm-serif)',
                fontStyle: 'italic',
                backgroundImage: BRAND_GRADIENT,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
                // El glifo itálico de la 'e' final se inclina fuera de la caja
                // de texto y el background-clip lo recorta; un padding derecho
                // le da aire sin afectar el centrado.
                paddingRight: '0.12em',
              }}
            >
              Empire
            </span>
            <span
              className="block text-[0.5rem] sm:text-[0.56rem] uppercase text-ink-muted leading-none mt-1 sm:mt-1.5"
              style={{
                fontFamily: 'var(--font-geist-sans)',
                letterSpacing: '0.42em',
                // El tracking añade espacio a la derecha de la última letra; un
                // padding izquierdo equivalente reequilibra el centrado óptico.
                paddingLeft: '0.42em',
              }}
            >
              Signal
            </span>
          </div>

          {/* 2. Headline */}
          <h1
            className="text-[1.2rem] sm:text-[clamp(1.35rem,2.4vw,1.9rem)] tracking-tight text-ink leading-[1.2] sm:leading-[1.15] text-center mb-2.5 sm:mb-3"
            style={{ fontFamily: 'var(--font-dm-serif)' }}
          >
            {t.headline}
          </h1>

          {/* 3. Subheadline */}
          <p className="text-xs sm:text-sm text-ink-faint sm:text-ink-muted leading-relaxed text-center mb-4 sm:mb-5 max-w-[400px] sm:max-w-[440px] mx-auto">
            {t.subheadline}
          </p>

          {/* Word of the Day — editorial kicker (not a boxed card, to avoid the
              templated feel). Sits above the search card so it's the first thing
              seen; tapping opens the pre-cached full analysis (no AI/limit cost). */}
          {wordOfDay && word.length === 0 && (
            <div className="text-center mb-4 sm:mb-6">
              <button
                onClick={handleOpenWordOfDay}
                className="group inline-flex flex-wrap items-baseline justify-center gap-x-2.5 gap-y-1"
              >
                <span className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                  {t.wordOfDayLabel}
                </span>
                <span
                  className="text-[1.15rem] sm:text-[1.3rem] italic text-accent leading-none decoration-accent/30 underline-offset-4 group-hover:underline"
                  style={{ fontFamily: 'var(--font-dm-serif)' }}
                >
                  {wordOfDay.word}
                </span>
                <span
                  aria-hidden
                  className="text-accent text-sm transition-transform duration-150 group-hover:translate-x-0.5"
                >
                  →
                </span>
              </button>
            </div>
          )}

          {/* 4. Search card */}
          <div className="w-full bg-surface border border-line rounded-[12px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">

            {/* Language toggle */}
            <div className="flex items-center justify-end px-5 sm:px-7 pt-4 sm:pt-5">
              <div className="flex gap-1.5">
                {(['en', 'es'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
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

            {/* Input — protagonist */}
            <div className="px-5 sm:px-7 pt-4 pb-3">
              <form onSubmit={(e) => { e.preventDefault(); if (canAnalyze) handleAnalyze(); }}>
                <input
                  type="text"
                  value={word}
                  onChange={handleWordChange}
                  enterKeyHint="go"
                  placeholder={isDesktop ? t.placeholder : t.placeholderShort}
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={40}
                  className="w-full bg-transparent text-[1.5rem] font-medium text-ink placeholder:text-ink-faint outline-none border-b-2 border-line focus:border-accent transition-colors duration-200 pb-1"
                />
              </form>
              {word.length === 0 && (
                <button
                  onClick={() => {
                    setWord(t.exampleWord);
                    setCuriosityVisible(false);
                    track('example_word_clicked', { word: t.exampleWord });
                    handleAnalyzeWithWord(t.exampleWord);
                  }}
                  className="mt-2.5 inline-block rounded-full border bg-[var(--badge-bg)] border-[var(--badge-border)] text-accent text-xs px-3 py-1 transition-colors cursor-pointer"
                >
                  {t.exampleLabel} <span className="font-medium">{t.exampleWord}</span> →
                </button>
              )}
              {word.length >= 25 && (
                <p
                  className="text-right text-[10px] mt-0.5"
                  style={{ color: word.length === 40 ? 'var(--danger)' : undefined }}
                >
                  <span className={word.length < 40 ? 'text-ink-faint' : ''}>
                    {word.length}/40
                  </span>
                </p>
              )}
              {spellingError && (
                <div style={{ marginTop: '4px', animation: 'fadeIn 0.25s ease' }}>
                  <p style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{spellingError}</p>
                  {spellingSuggestion && (
                    <button
                      onClick={() => {
                        setSpellingError(null);
                        setSpellingSuggestion(null);
                        setSpellingCanForce(false);
                        setWord(spellingSuggestion);
                        handleAnalyzeWithWord(spellingSuggestion);
                      }}
                      style={{
                        color: 'var(--accent)',
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
                      {t.didYouMean} &ldquo;{spellingSuggestion}&rdquo;?
                    </button>
                  )}
                  {spellingCanForce && (
                    <button
                      onClick={() => {
                        const w = word;
                        setSpellingError(null);
                        setSpellingSuggestion(null);
                        setSpellingCanForce(false);
                        handleAnalyzeWithWord(w, undefined, true);
                      }}
                      style={{
                        color: 'var(--accent)',
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
                      {t.analyzeAnyway}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const other: Language = language === 'es' ? 'en' : 'es';
                      setSpellingError(null);
                      setSpellingSuggestion(null);
                      setSpellingCanForce(false);
                      setLanguage(other);
                      handleAnalyzeWithWord(word, other);
                    }}
                    style={{
                      color: 'var(--accent)',
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
                    {t.otherLangCta}
                  </button>
                </div>
              )}
            </div>

            {/* Inline translator */}
            {canAnalyze && !spellingError && (
              <div className="px-5 sm:px-7 pb-5 border-t border-line pt-4">
                {!translateExpanded ? (
                  <button
                    onClick={() => {
                      setTranslateExpanded(true);
                      setSelectedLangs([]);
                      setTranslationState({ status: 'idle' });
                    }}
                    className="px-3 py-1 rounded-[6px] text-xs font-medium border border-line text-ink-muted hover:text-ink hover:border-ink-muted transition-all duration-150"
                  >
                    {t.translate}
                  </button>
                ) : (
                  <>
                    <div className="flex gap-1.5 flex-wrap mb-3">
                      {TRANSLATE_LANGS.map((l) => {
                        const selected = selectedLangs.includes(l.id);
                        return (
                          <button
                            key={l.id}
                            onClick={() => toggleTranslateLang(l.id)}
                            disabled={translationState.status === 'loading'}
                            aria-pressed={selected}
                            className={`px-2.5 py-1 rounded-[6px] text-xs font-medium border transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                              selected
                                ? 'bg-accent text-white border-accent'
                                : 'bg-bg text-ink-muted border-line hover:text-ink hover:border-ink-muted'
                            }`}
                          >
                            {l.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleTranslate}
                        disabled={selectedLangs.length === 0 || translationState.status === 'loading'}
                        className="shrink-0 px-3 py-1.5 rounded-[6px] text-xs font-semibold border bg-accent text-white border-accent enabled:hover:bg-accent-hover transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {translationState.status === 'loading' ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                            {t.translating}
                          </span>
                        ) : (
                          `${t.translate}${selectedLangs.length > 0 ? ` (${selectedLangs.length})` : ''}`
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setTranslateExpanded(false);
                          setSelectedLangs([]);
                          setTranslationState({ status: 'idle' });
                        }}
                        disabled={translationState.status === 'loading'}
                        className="shrink-0 p-1.5 text-ink-faint hover:text-ink transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={t.close}
                      >
                        <IconClose />
                      </button>
                    </div>
                  </>
                )}

                {translationState.status === 'result' && (
                  <div className="mt-4 flex flex-col gap-4">
                    {translationState.translations.map(({ lang, text }) => (
                      <div key={lang} className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[1.5rem] font-bold tracking-tight leading-none" style={{ color: 'var(--text-primary)' }}>
                            {text}
                          </p>
                          <p
                            className="mt-1.5 text-[0.65rem] font-semibold uppercase"
                            style={{ color: 'var(--text-subtle)', letterSpacing: '0.08em' }}
                          >
                            {TRANSLATE_LANGS.find((l) => l.id === lang)?.label}
                          </p>
                        </div>
                        <button
                          onClick={() => navigator.clipboard.writeText(text)}
                          className="mt-1 shrink-0 text-ink-faint hover:text-ink transition-colors duration-150"
                          title="Copy"
                        >
                          <IconCopy />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {translationState.status === 'error' && (
                  <p className="mt-3 text-xs" style={{ color: 'var(--danger)' }}>
                    {translationState.message}
                  </p>
                )}
              </div>
            )}

            {/* Section divider — only when the inline translator area is visible */}
            {canAnalyze && !spellingError && <div className="h-px bg-line" />}

            {/* Options */}
            <div className="px-5 sm:px-7 pt-3 pb-5 space-y-3">

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

              {/* Analyze is the single primary action; Empire Lens is a quiet secondary link below. */}
              <button
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className="w-full py-3.5 rounded-lg text-sm font-semibold tracking-wide border shadow-md transition-all duration-150 enabled:bg-accent enabled:text-white enabled:border-transparent enabled:cursor-pointer enabled:hover:shadow-lg enabled:hover:brightness-110 enabled:active:scale-[0.99] enabled:active:shadow disabled:bg-transparent disabled:border-[var(--border)] disabled:text-[var(--text-subtle)] disabled:shadow-none disabled:cursor-not-allowed"
              >
                {t.analyze}
              </button>
              <div className="mt-3 text-center">
                <Link
                  href="/lens"
                  className="text-xs text-ink-muted hover:text-accent transition-colors"
                >
                  {t.lensLink}{' '}
                  <span
                    className="italic"
                    style={{ fontFamily: 'var(--font-dm-serif)' }}
                  >
                    Empire Lens
                  </span>{' '}
                  →
                </Link>
              </div>
            </div>
          </div>

          {/* Session history chips */}
          {sessionHistory.length > 0 && word.length === 0 && (
            <div className="mt-5">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-ink-faint mb-2">
                {t.recent}
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {sessionHistory.slice(0, 6).map((entry) => (
                  <button
                    key={entry.word}
                    onPointerDown={() => startHistoryLongPress(entry)}
                    onPointerUp={cancelHistoryLongPress}
                    onPointerLeave={cancelHistoryLongPress}
                    onContextMenu={(e) => e.preventDefault()}
                    onClick={() => {
                      if (longPressFired.current) {
                        longPressFired.current = false;
                        return;
                      }
                      setLanguage(entry.language);
                      setWord(entry.word);
                      setCuriosityVisible(false);
                      handleAnalyzeWithWord(entry.word, entry.language);
                    }}
                    style={{ userSelect: 'none', touchAction: 'manipulation' }}
                    className="text-xs text-accent border border-[var(--badge-border)] bg-[var(--badge-bg)] rounded-full hover:border-accent hover:text-accent transition-colors duration-150 px-3.5 py-1.5"
                  >
                    {entry.word}
                  </button>
                ))}
              </div>
              <Link
                href="/history"
                className="inline-block mt-2 text-xs text-ink-muted hover:text-ink transition-colors"
              >
                {t.viewAll}
              </Link>
            </div>
          )}

          {/* Empire Insight — shown only to new users (no Recent chips), never stacked with them */}
          {sessionHistory.length === 0 && (
            <div
              className={`mt-6 rounded-[12px] border border-line border-l-2 border-l-accent bg-[var(--surface-muted)] px-4 py-3.5 transition-opacity duration-500 ${
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
          )}

        </div>
      </main>
    </>
  );
}
