'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { LensProfile } from '@/lib/ai/schemas/lens';

type Lang = 'en' | 'es';

const MAX_WORDS = 400;
const MIN_WORDS = 5;
// Persist the last report so a refresh doesn't discard a costly ~60s generation.
const STORAGE_KEY = 'lens:last:v1';
// A 503 means every free AI provider was momentarily saturated; that usually
// clears in a second, so retry once silently before surfacing an error.
const RETRY_DELAY_MS = 1500;
const REQUEST_TIMEOUT_MS = 60000;

const BRAND_GRADIENT = 'linear-gradient(90deg, #3A3D8F 0%, #5B5FCF 100%)';

const UI = {
  en: {
    back:            '← Empire Signal',
    lensWord:        'Lens',
    headline:        'What does your writing reveal?',
    sub:             'Paste something you wrote. Empire Lens reads it like a teacher would — your register, your habits, your range — and shows you the one thing to grow next. Not a rewrite. A mirror.',
    placeholder:     'Paste a paragraph you wrote — an email, a message, a few sentences…',
    langLabel:       'Language',
    analyze:         'Analyze with Lens',
    analyzing:       'Reading your writing…',
    loadingSteps:    [
      'Reading your writing…',
      'Weighing your register…',
      'Measuring your lexical range…',
      'Spotting your habits…',
      'Finding the one thing to grow…',
    ],
    over:            (n: number) => `${n} / ${MAX_WORDS} words — a little over. Trim it down.`,
    under:           (n: number) => `${n} / ${MAX_WORDS} words — write at least ${MIN_WORDS}.`,
    counter:         (n: number) => `${n} / ${MAX_WORDS} words`,
    errorTitle:      'Something went wrong',
    tryAgain:        'Try again',
    rateTitle:       "You've reached today's Lens limit",
    rateSub:         'Lens reads deeply, so it’s limited to 3 texts a day for now. Come back tomorrow — or analyze individual words in Empire Signal anytime.',
    // report
    registerLabel:   'Register',
    spellingLabel:   'Spelling',
    consistent:      'consistent',
    mixed:           'mixed register',
    lexicalLabel:    'Lexical variety',
    overusedLabel:   'Leaned on',
    crutchLabel:     'Crutch words',
    patternsLabel:   'How you write',
    signalsLabel:    'Spanish-speaker signals',
    growthLabel:     'Your growth focus',
    shareGrowth:     'Share',
    copied:          'Copied',
    textLabel:       'Your text',
    textHint:        'Tap a highlighted word for stronger alternatives.',
    noWeak:          'Nothing felt weak here — your word choices hold up.',
    strongerThan:    (w: string) => `Stronger than “${w}”`,
    analyzeInEmpire: 'Analyze in Empire',
    close:           'Close',
    newAnalysis:     '← Analyze another text',
  },
  es: {
    back:            '← Empire Signal',
    lensWord:        'Lens',
    headline:        '¿Qué revela tu escritura?',
    sub:             'Pega algo que hayas escrito. Empire Lens lo lee como lo haría un profesor — tu registro, tus hábitos, tu rango — y te muestra la única cosa en la que crecer. No es una reescritura. Es un espejo.',
    placeholder:     'Pega un párrafo que escribiste — un correo, un mensaje, unas frases…',
    langLabel:       'Idioma',
    analyze:         'Analizar con Lens',
    analyzing:       'Leyendo tu escritura…',
    loadingSteps:    [
      'Leyendo tu escritura…',
      'Sopesando tu registro…',
      'Midiendo tu variedad léxica…',
      'Detectando tus hábitos…',
      'Buscando la única cosa en la que crecer…',
    ],
    over:            (n: number) => `${n} / ${MAX_WORDS} palabras — un poco largo. Acórtalo.`,
    under:           (n: number) => `${n} / ${MAX_WORDS} palabras — escribe al menos ${MIN_WORDS}.`,
    counter:         (n: number) => `${n} / ${MAX_WORDS} palabras`,
    errorTitle:      'Algo salió mal',
    tryAgain:        'Intentar de nuevo',
    rateTitle:       'Alcanzaste el límite de Lens de hoy',
    rateSub:         'Lens lee a fondo, así que por ahora se limita a 3 textos al día. Vuelve mañana — o analiza palabras sueltas en Empire Signal cuando quieras.',
    registerLabel:   'Registro',
    spellingLabel:   'Ortografía',
    consistent:      'consistente',
    mixed:           'registro mixto',
    lexicalLabel:    'Variedad léxica',
    overusedLabel:   'Te apoyaste en',
    crutchLabel:     'Muletillas',
    patternsLabel:   'Cómo escribes',
    signalsLabel:    'Señales de interferencia',
    growthLabel:     'Tu enfoque de crecimiento',
    shareGrowth:     'Compartir',
    copied:          'Copiado',
    textLabel:       'Tu texto',
    textHint:        'Toca una palabra resaltada para ver alternativas más fuertes.',
    noWeak:          'Nada se sintió débil aquí — tus elecciones de palabras se sostienen.',
    strongerThan:    (w: string) => `Más fuerte que «${w}»`,
    analyzeInEmpire: 'Analizar en Empire',
    close:           'Cerrar',
    newAnalysis:     '← Analizar otro texto',
  },
} as const;

const REGISTER_LABEL: Record<Lang, Record<LensProfile['register']['level'], string>> = {
  en: { formal: 'Formal', neutral: 'Neutral', casual: 'Casual', technical: 'Technical' },
  es: { formal: 'Formal', neutral: 'Neutral', casual: 'Casual', technical: 'Técnico' },
};

function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

// Strip leading/trailing non-letter/digit so "good." matches "good".
function normalizeToken(raw: string): string {
  return raw.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

type WordSuggestion = LensProfile['wordSuggestions'][number];

// Maps each wordSuggestion to a concrete token in the text. The AI's `position`
// is only an approximate anchor (it miscounts by ±1), so we resolve robustly:
// prefer the exact position if it matches the suggested word, else the closest
// unclaimed occurrence of that word. A `claimed` set keeps repeated words (e.g.
// "good" five times) mapping to DISTINCT occurrences instead of all stacking on
// the first one.
function mapSuggestions(text: string, suggestions: WordSuggestion[]) {
  const tokens = text.trim().split(/\s+/);
  const norm = tokens.map(normalizeToken);

  const occurrences = new Map<string, number[]>();
  norm.forEach((w, i) => {
    if (!w) return;
    const list = occurrences.get(w);
    if (list) list.push(i);
    else occurrences.set(w, [i]);
  });

  const claimed = new Set<number>();
  const byToken = new Map<number, WordSuggestion>();

  for (const sug of suggestions) {
    const key = normalizeToken(sug.word);
    const candidates = (occurrences.get(key) ?? []).filter((i) => !claimed.has(i));
    if (candidates.length === 0) continue;

    let chosen = candidates.find((i) => i === sug.position);
    if (chosen === undefined) {
      chosen = candidates.reduce((best, i) =>
        Math.abs(i - sug.position) < Math.abs(best - sug.position) ? i : best,
      candidates[0]);
    }
    claimed.add(chosen);
    byToken.set(chosen, sug);
  }

  return { tokens, byToken };
}

function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'accent' | 'warn' }) {
  const styles: Record<string, React.CSSProperties> = {
    neutral: { background: 'var(--surface-muted)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
    accent:  { background: 'var(--badge-bg)', color: 'var(--accent)', border: '1px solid var(--badge-border)' },
    warn:    { background: 'var(--surface-error)', color: 'var(--warning)', border: '1px solid var(--border)' },
  };
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.75rem] font-medium"
      style={styles[tone]}
    >
      {children}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-ink-faint mb-3">
      {children}
    </h2>
  );
}

// ── Suggestion bottom-sheet / panel ──────────────────────────────────────────
function SuggestionPanel({
  suggestion, language, onClose,
}: { suggestion: WordSuggestion; language: Lang; onClose: () => void }) {
  const t = UI[language];

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.32)', animation: 'fadeIn 150ms ease' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-[440px] bg-surface border border-line sm:rounded-[16px] rounded-t-[20px] shadow-[0_8px_40px_rgba(0,0,0,0.18)] p-6 sm:p-7"
        style={{ animation: 'lensSheetUp 220ms cubic-bezier(0.16,1,0.3,1)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between mb-5">
          <p
            className="text-[1.05rem] text-ink"
            style={{ fontFamily: 'var(--font-dm-serif)' }}
          >
            {t.strongerThan(suggestion.word)}
          </p>
          <button
            onClick={onClose}
            aria-label={t.close}
            className="shrink-0 -mt-1 -mr-1 p-1.5 text-ink-faint hover:text-ink transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {suggestion.alternatives.map((alt, i) => (
            <Link
              key={`${alt.word}-${i}`}
              href={`/?w=${encodeURIComponent(alt.word)}&lang=${language}`}
              className="group flex items-start gap-3 rounded-[10px] border border-line p-3.5 hover:border-accent transition-colors"
              style={{ background: i === 0 ? 'var(--surface-blue)' : 'var(--surface)' }}
            >
              <div className="flex-1 min-w-0">
                <span
                  className="text-[1rem] text-accent"
                  style={{ fontFamily: 'var(--font-dm-serif)' }}
                >
                  {alt.word}
                </span>
                <p className="text-[0.82rem] text-ink-muted leading-relaxed mt-0.5">{alt.reason}</p>
              </div>
              <span className="shrink-0 self-center text-[0.66rem] font-semibold uppercase tracking-wider text-ink-faint group-hover:text-accent transition-colors flex items-center gap-1">
                {t.analyzeInEmpire}
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">↗</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Annotated original text ──────────────────────────────────────────────────
function AnnotatedText({
  text, suggestions, language, onPick,
}: { text: string; suggestions: WordSuggestion[]; language: Lang; onPick: (s: WordSuggestion) => void }) {
  const { byToken } = useMemo(() => mapSuggestions(text, suggestions), [text, suggestions]);
  // Keep the original whitespace after each token (newlines included) so pasted
  // paragraphs render with their line breaks instead of collapsing to one block.
  // Token order matches mapSuggestions' split(/\s+/), so `byToken` indices align.
  const parts = useMemo(
    () => [...text.trim().matchAll(/(\S+)(\s*)/g)].map((m) => ({ tok: m[1], sep: m[2] })),
    [text],
  );

  return (
    <p
      className="text-[1.02rem] sm:text-[1.08rem] leading-[1.9] text-ink-muted"
      style={{ fontFamily: 'var(--font-dm-serif)', whiteSpace: 'pre-wrap' }}
    >
      {parts.map(({ tok, sep }, i) => {
        const sug = byToken.get(i);
        if (!sug) return <span key={i}>{tok}{sep}</span>;
        return (
          <span key={i}>
            <button
              onClick={() => onPick(sug)}
              className="text-ink underline decoration-dotted decoration-accent/60 underline-offset-[5px] hover:decoration-solid hover:text-accent transition-colors cursor-pointer"
              style={{ textDecorationThickness: '1.5px' }}
              aria-label={UI[language].strongerThan(tok)}
            >
              {tok}
            </button>
            {sep}
          </span>
        );
      })}
    </p>
  );
}

// ── The diagnostic report ────────────────────────────────────────────────────
function LensReport({
  profile, text, language,
}: { profile: LensProfile; text: string; language: Lang }) {
  const t = UI[language];
  const [active, setActive] = useState<WordSuggestion | null>(null);
  const [copied, setCopied] = useState(false);
  const { register, spelling, lexicalVariety, patterns, spanishSignals, wordSuggestions, growthFocus } = profile;

  const shareGrowth = useCallback(async () => {
    const url = `${window.location.origin}/lens`;
    const body = `${growthFocus}\n\n— Empire Lens`;
    // Native share sheet on mobile is the ideal path for Reddit/IG; otherwise copy.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ text: body, url }); } catch { /* user cancelled */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${body}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  }, [growthFocus]);

  return (
    <div className="flex flex-col gap-9" style={{ animation: 'lensRise 320ms ease' }}>

      {/* Register */}
      <section>
        <SectionLabel>{t.registerLabel}</SectionLabel>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <Pill tone="accent">{REGISTER_LABEL[language][register.level]}</Pill>
          <Pill tone={register.consistency === 'mixed' ? 'warn' : 'neutral'}>
            {register.consistency === 'mixed' ? t.mixed : t.consistent}
          </Pill>
        </div>
        <p className="text-[0.95rem] text-ink-muted leading-relaxed">{register.note}</p>
      </section>

      {/* Spelling — the one place Lens corrects; shown only if real errors exist */}
      {spelling.length > 0 && (
        <section>
          <SectionLabel>{t.spellingLabel}</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {spelling.map((s, i) => (
              <div key={i} className="flex items-center gap-2.5 text-[0.95rem]">
                <span className="line-through" style={{ color: 'var(--warning)' }}>{s.word}</span>
                <span aria-hidden className="text-ink-faint">→</span>
                <span style={{ color: 'var(--success)', fontFamily: 'var(--font-dm-serif)' }}>{s.correction}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lexical variety */}
      <section>
        <SectionLabel>{t.lexicalLabel}</SectionLabel>
        <p className="text-[0.95rem] text-ink-muted leading-relaxed mb-4">{lexicalVariety.assessment}</p>
        {lexicalVariety.overused.length > 0 && (
          <div className="mb-3">
            <p className="text-[0.7rem] uppercase tracking-wider text-ink-faint mb-2">{t.overusedLabel}</p>
            <div className="flex flex-wrap gap-2">
              {lexicalVariety.overused.map((o, i) => (
                <Pill key={i} tone="warn">
                  {o.word} <span className="opacity-60">×{o.count}</span>
                </Pill>
              ))}
            </div>
          </div>
        )}
        {lexicalVariety.crutchWords.length > 0 && (
          <div>
            <p className="text-[0.7rem] uppercase tracking-wider text-ink-faint mb-2">{t.crutchLabel}</p>
            <div className="flex flex-wrap gap-2">
              {lexicalVariety.crutchWords.map((w, i) => <Pill key={i}>{w}</Pill>)}
            </div>
          </div>
        )}
      </section>

      {/* Patterns */}
      {patterns.length > 0 && (
        <section>
          <SectionLabel>{t.patternsLabel}</SectionLabel>
          <ul className="flex flex-col gap-3.5">
            {patterns.map((p, i) => (
              <li key={i} className="flex gap-3 text-[0.95rem] text-ink-muted leading-relaxed">
                <span aria-hidden className="shrink-0 mt-[0.55rem] w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Spanish-speaker signals (only if present) */}
      {spanishSignals.length > 0 && (
        <section>
          <SectionLabel>{t.signalsLabel}</SectionLabel>
          <div className="flex flex-col gap-3">
            {spanishSignals.map((s, i) => (
              <div key={i} className="rounded-[10px] border border-line p-4" style={{ background: 'var(--surface-muted)' }}>
                <p className="text-[0.9rem] font-semibold text-ink mb-1.5">{s.issue}</p>
                <p className="text-[0.88rem] text-ink-muted leading-relaxed mb-1.5">
                  <span className="italic" style={{ fontFamily: 'var(--font-dm-serif)' }}>“{s.example}”</span>
                </p>
                <p className="text-[0.88rem] leading-relaxed" style={{ color: 'var(--success)' }}>{s.fix}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Growth focus — the emotional payoff */}
      <section
        className="rounded-[14px] p-6 sm:p-7"
        style={{ background: 'var(--surface-blue)', borderLeft: '3px solid var(--accent)' }}
      >
        <SectionLabel>{t.growthLabel}</SectionLabel>
        <p
          className="text-[1.15rem] sm:text-[1.3rem] text-ink leading-[1.5]"
          style={{ fontFamily: 'var(--font-dm-serif)' }}
        >
          {growthFocus}
        </p>
        <div className="mt-5 flex justify-end">
          <button
            onClick={shareGrowth}
            className="inline-flex items-center gap-1.5 text-[0.72rem] font-semibold uppercase tracking-wider text-ink-faint hover:text-accent transition-colors"
          >
            {copied ? (
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M9.5 4.5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v5.5a1 1 0 001 1h1.5M5.5 4.5H11a1 1 0 011 1V11a1 1 0 01-1 1H5.5a1 1 0 01-1-1V5.5a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {copied ? t.copied : t.shareGrowth}
          </button>
        </div>
      </section>

      {/* Annotated text + word suggestions */}
      <section>
        <SectionLabel>{t.textLabel}</SectionLabel>
        {wordSuggestions.length > 0 && (
          <p className="text-[0.8rem] text-ink-faint mb-3">{t.textHint}</p>
        )}
        <AnnotatedText text={text} suggestions={wordSuggestions} language={language} onPick={setActive} />
        {wordSuggestions.length === 0 && (
          <p className="text-[0.85rem] text-ink-faint mt-3 italic">{t.noWeak}</p>
        )}
      </section>

      {active && (
        <SuggestionPanel suggestion={active} language={language} onClose={() => setActive(null)} />
      )}
    </div>
  );
}

// ── Loading indicator ────────────────────────────────────────────────────────
// A single spinner for a ~60s free-model generation reads as "stuck", so we walk
// through the phases the analysis actually goes through. Advances and stops on
// the last step rather than looping, to imply forward progress.
function LoadingIndicator({ language }: { language: Lang }) {
  const steps = UI[language].loadingSteps;
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((prev) => Math.min(prev + 1, steps.length - 1)), 2800);
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div className="mt-10 flex flex-col items-center gap-3">
      <div className="w-4 h-4 border-2 border-line border-t-accent rounded-full animate-spin motion-reduce:hidden" />
      <p key={i} className="text-sm text-ink-faint" style={{ animation: 'fadeIn 300ms ease' }}>
        {steps[i]}
      </p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; profile: LensProfile; text: string }
  | { status: 'error'; message: string; rateLimited?: boolean };

export default function LensClient() {
  const [language, setLanguage] = useState<Lang>('en');
  const [text, setText] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.profile && typeof parsed.text === 'string'
          && (parsed.language === 'en' || parsed.language === 'es')) {
          setLanguage(parsed.language);
          setState({ status: 'result', profile: parsed.profile, text: parsed.text });
          return;
        }
      }
    } catch { /* ignore corrupt payload */ }
    try {
      const l = localStorage.getItem('language');
      if (l === 'es' || l === 'en') setLanguage(l);
    } catch { /* ignore */ }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (state.status !== 'result') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        profile: state.profile, text: state.text, language,
      }));
    } catch { /* quota or disabled */ }
  }, [state, language]);

  const t = UI[language];
  const words = countWords(text);
  const over = words > MAX_WORDS;
  const under = words > 0 && words < MIN_WORDS;
  const canAnalyze = words >= MIN_WORDS && !over && state.status !== 'loading';

  const setLang = useCallback((l: Lang) => {
    setLanguage(l);
    try { localStorage.setItem('language', l); } catch { /* ignore */ }
  }, []);

  const analyze = useCallback(async (): Promise<void> => {
    setState({ status: 'loading' });
    // One silent retry on a 503 (provider saturation), then surface the error.
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch('/api/lens', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, language }),
          signal: controller.signal,
        });

        if (res.status === 429) {
          setState({ status: 'error', message: t.rateSub, rateLimited: true });
          return;
        }
        if (res.status === 503 && attempt === 0) {
          clearTimeout(timer);
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setState({ status: 'error', message: (data && data.error) || t.errorTitle });
          return;
        }
        setState({ status: 'result', profile: data.profile, text });
        return;
      } catch {
        setState({ status: 'error', message: t.errorTitle });
        return;
      } finally {
        clearTimeout(timer);
      }
    }
  }, [text, language, t]);

  return (
    <main className="min-h-screen bg-bg flex flex-col items-center px-4 pt-4 pb-20">
      <div className="w-full max-w-[640px]">

        {/* Top bar */}
        <div className="flex items-center justify-between py-2 mb-6 sm:mb-10">
          <Link href="/" className="text-xs text-ink-muted hover:text-ink transition-colors">
            {t.back}
          </Link>
          <div className="flex gap-1.5">
            {(['en', 'es'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2.5 py-1 rounded-[6px] text-xs font-medium border transition-all ${
                  language === l
                    ? 'border-accent text-accent'
                    : 'border-line text-ink-faint hover:text-ink-muted'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Wordmark */}
        <div className="text-center mb-5 sm:mb-6">
          <span
            className="inline-block text-[2.25rem] sm:text-[2.75rem] tracking-tight leading-none"
            style={{
              fontFamily: 'var(--font-dm-serif)', fontStyle: 'italic',
              backgroundImage: BRAND_GRADIENT, WebkitBackgroundClip: 'text',
              backgroundClip: 'text', WebkitTextFillColor: 'transparent',
              color: 'transparent', paddingRight: '0.12em',
            }}
          >
            Empire
          </span>
          <span
            className="block text-[0.62rem] sm:text-[0.72rem] uppercase text-ink-muted leading-none mt-1.5 sm:mt-2"
            style={{ fontFamily: 'var(--font-geist-sans)', letterSpacing: '0.42em', paddingLeft: '0.42em' }}
          >
            {t.lensWord}
          </span>
        </div>

        {/* Headline */}
        <h1
          className="text-[1.35rem] sm:text-[clamp(1.6rem,3vw,2.4rem)] tracking-tight text-ink leading-[1.18] text-center mb-3"
          style={{ fontFamily: 'var(--font-dm-serif)' }}
        >
          {t.headline}
        </h1>
        <p className="text-xs sm:text-sm text-ink-faint sm:text-ink-muted leading-relaxed text-center mb-7 sm:mb-9 max-w-[500px] mx-auto">
          {t.sub}
        </p>

        {/* Input card */}
        {state.status !== 'result' && (
          <div className="w-full bg-surface border border-line rounded-[12px] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
            <div className="flex items-center justify-between px-5 sm:px-7 pt-4 sm:pt-5">
              <span className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-ink-faint select-none">
                {t.langLabel}
              </span>
              <div className="flex gap-1.5">
                {(['en', 'es'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`px-3 py-1 rounded-[6px] text-xs font-medium border transition-all ${
                      language === l ? 'border-accent text-accent' : 'border-line text-ink-faint hover:text-ink-muted'
                    }`}
                  >
                    {l === 'en' ? 'English' : 'Español'}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-5 sm:px-7 py-4 sm:py-5">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t.placeholder}
                rows={7}
                disabled={state.status === 'loading'}
                className="w-full resize-none bg-transparent text-ink text-[1rem] leading-[1.7] placeholder:text-ink-faint focus:outline-none disabled:opacity-60"
                style={{ fontFamily: 'var(--font-dm-serif)' }}
              />
              <div className="flex items-center justify-between mt-2 pt-3 border-t border-line">
                <span
                  className="text-[0.78rem] font-medium tabular-nums"
                  style={{ color: over || under ? 'var(--warning)' : 'var(--text-faint, var(--text-subtle))' }}
                >
                  {over ? t.over(words) : under ? t.under(words) : t.counter(words)}
                </span>
                <button
                  onClick={() => analyze()}
                  disabled={!canAnalyze}
                  className="px-5 py-2 rounded-[8px] text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: canAnalyze ? 'var(--accent)' : 'var(--text-subtle)' }}
                >
                  {state.status === 'loading' ? t.analyzing : t.analyze}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {state.status === 'loading' && <LoadingIndicator language={language} />}

        {/* Error / rate limit */}
        {state.status === 'error' && (
          <div className="mt-8 rounded-[12px] border border-line p-6 text-center" style={{ background: 'var(--surface-error)' }}>
            <p className="text-[0.95rem] font-semibold text-ink mb-2" style={{ fontFamily: 'var(--font-dm-serif)' }}>
              {state.rateLimited ? t.rateTitle : t.errorTitle}
            </p>
            <p className="text-sm text-ink-muted leading-relaxed mb-4">{state.message}</p>
            {!state.rateLimited && (
              <button
                onClick={() => analyze()}
                className="px-4 py-2 rounded-[8px] text-sm font-medium text-white"
                style={{ background: 'var(--accent)' }}
              >
                {t.tryAgain}
              </button>
            )}
          </div>
        )}

        {/* Result */}
        {state.status === 'result' && (
          <>
            <LensReport profile={state.profile} text={state.text} language={language} />
            <div className="mt-10 text-center">
              <button
                onClick={() => {
                  setState({ status: 'idle' });
                  setText('');
                  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
                }}
                className="text-sm text-ink-muted hover:text-ink transition-colors"
              >
                {t.newAnalysis}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
