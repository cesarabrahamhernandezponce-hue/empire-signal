'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import type { Analysis } from '@/lib/ai/schemas/analysis';
import { track } from '@/lib/analytics';

export type AnalyzeRecord = {
  id: string;
  word: string;
  context: string | null;
  language: string;
  analysis: Analysis;
  shareId: string;
};

interface Props {
  record: AnalyzeRecord;
  cacheHit?: boolean;
  onReset: () => void;
  onAnalyzeWord?: (word: string) => void;
  user?: User | null;
  onSignOut?: () => void;
  hasHistory?: boolean;
}

const cardBase: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: '12px',
  border: '1px solid var(--border)',
  padding: '24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
};

function SectionLabel({ children, serif }: { children: React.ReactNode; serif?: boolean }) {
  return (
    <p
      className="mb-3 text-[0.75rem] font-semibold uppercase"
      style={{ color: '#3A3D8F', letterSpacing: '0.12em', fontFamily: serif ? 'var(--font-dm-serif)' : undefined }}
    >
      {children}
    </p>
  );
}

function RegisterBadge({ label }: { label: string }) {
  return (
    <span
      className="shrink-0 text-[0.6rem] font-semibold uppercase rounded-[4px] px-1.5 py-0.5"
      style={{ background: 'var(--badge-bg)', color: 'var(--accent)', border: '1px solid var(--badge-border)', letterSpacing: '0.08em' }}
    >
      {label}
    </span>
  );
}

function IconBack() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSpeaker() {
  return (
    <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 5H5L9 2V12L5 9H2V5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M11 4.5C11.9 5.4 12.5 6.1 12.5 7C12.5 7.9 11.9 8.6 11 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconStop() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="1" fill="currentColor" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M6 2H3C2.4 2 2 2.4 2 3V11C2 11.6 2.4 12 3 12H11C11.6 12 12 11.6 12 11V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9 2H12V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7L12 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="5" y="5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 9V3C2 2.4 2.4 2 3 2H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2v7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M4.5 6.5L7 9l2.5-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const CEFR_STYLES: Record<string, { background: string; color: string }> = {
  A1: { background: '#E8F5E9', color: '#2E7D32' },
  A2: { background: '#E8F5E9', color: '#2E7D32' },
  B1: { background: '#FFF8E1', color: '#F57F17' },
  B2: { background: '#FFF8E1', color: '#F57F17' },
  C1: { background: '#EEF0FF', color: '#3A3D8F' },
  C2: { background: '#EEF0FF', color: '#3A3D8F' },
};

function CefrBadge({ level }: { level: string }) {
  const s = CEFR_STYLES[level] ?? { background: '#F0F0EE', color: '#1A1A1A' };
  return (
    <span
      style={{
        background: s.background,
        color: s.color,
        fontSize: '0.7rem',
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 4,
        letterSpacing: '0.06em',
        fontFamily: 'var(--font-geist-mono)',
      }}
    >
      {level}
    </span>
  );
}

function ClickableWord({ word, onAnalyze }: { word: string; onAnalyze?: (w: string) => void }) {
  if (!onAnalyze) return <>{word}</>;
  return (
    <button className="word-btn" onClick={() => onAnalyze(word)}>
      {word}
    </button>
  );
}

const LANG_CODE: Record<string, string> = { es: 'es-ES', en: 'en-US' };

const LABELS = {
  en: {
    newSearch:       'New search',
    back:            '← Back',
    listen:          'Listen',
    stop:            'Stop',
    share:           'Share',
    copied:          'Copied!',
    copy:            'Copy',
    meaning:         'Meaning',
    meanings:        'Meanings',
    meaningInCtx:    'Meaning in context',
    wordType:        'Word type',
    pronunciation:   'Pronunciation',
    usageExamples:   'Usage examples',
    collocations:    'Collocations',
    inYourContext:   'In your context',
    viewFull:        'View full analysis',
    hideFull:        'Hide full analysis',
    etymology:       'Etymology',
    story:           'The story behind',
    synonyms:        'Synonyms',
    antonyms:        'Antonyms',
    registerLevel:   'Register level',
    commonErrors:    'Common errors',
    wordFamily:      'Word family',
    analyzeAnother:  '← Analyze another word',
    notSupported:    'Not supported',
    validateSection: 'Validate your sentence',
    validateHint:    'Write a sentence using this word and we\'ll tell you if it sounds natural.',
    check:           'Check',
    soundsNatural:   'Sounds natural',
    needsAdjust:     'Needs adjustment',
    tryInstead:      'Try instead',
    askSection:      'Ask about this word',
    askBtn:          'Ask',
    asking:          'Asking...',
    saveCard:        'Save card',
    cardSaved:       'Saved!',
  },
  es: {
    newSearch:       'Nueva búsqueda',
    back:            '← Volver',
    listen:          'Escuchar',
    stop:            'Detener',
    share:           'Compartir',
    copied:          '¡Copiado!',
    copy:            'Copiar',
    meaning:         'Significado',
    meanings:        'Significados',
    meaningInCtx:    'Significado en contexto',
    wordType:        'Tipo de palabra',
    pronunciation:   'Pronunciación',
    usageExamples:   'Ejemplos de uso',
    collocations:    'Colocaciones',
    inYourContext:   'En tu contexto',
    viewFull:        'Ver análisis completo',
    hideFull:        'Ocultar análisis completo',
    etymology:       'Etimología',
    story:           'La historia detrás',
    synonyms:        'Sinónimos',
    antonyms:        'Antónimos',
    registerLevel:   'Nivel de registro',
    commonErrors:    'Errores comunes',
    wordFamily:      'Familia de palabras',
    analyzeAnother:  '← Analizar otra palabra',
    notSupported:    'No soportado',
    validateSection: 'Valida tu oración',
    validateHint:    'Escribe una oración con esta palabra y te diremos si suena natural.',
    check:           'Verificar',
    soundsNatural:   'Suena natural',
    needsAdjust:     'Necesita ajuste',
    tryInstead:      'Intenta así',
    askSection:      'Pregunta sobre esta palabra',
    askBtn:          'Preguntar',
    asking:          'Procesando...',
    saveCard:        'Guardar tarjeta',
    cardSaved:       '¡Guardado!',
  },
} as const;

type ValidationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; natural: boolean; score: number; feedback: string; suggestion?: string }
  | { status: 'error'; message: string };

type AskItem = { question: string; answer: string };

// ── Card generation ──────────────────────────────────────────────────────────

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    let last = lines[maxLines - 1];
    while (last.length > 0 && ctx.measureText(last + '…').width > maxWidth) {
      last = last.slice(0, -1).trimEnd();
    }
    return [...lines.slice(0, maxLines - 1), last + '…'];
  }
  return lines;
}

const CEFR_CARD_COLORS: Record<string, { bg: string; text: string }> = {
  A1: { bg: 'rgba(74,222,128,0.15)',  text: '#4ADE80' },
  A2: { bg: 'rgba(74,222,128,0.15)',  text: '#4ADE80' },
  B1: { bg: 'rgba(96,165,250,0.15)',  text: '#60A5FA' },
  B2: { bg: 'rgba(96,165,250,0.15)',  text: '#60A5FA' },
  C1: { bg: 'rgba(192,132,252,0.15)', text: '#C084FC' },
  C2: { bg: 'rgba(192,132,252,0.15)', text: '#C084FC' },
};

function generateCard(word: string, essential: Analysis['essential'], etymology: string): void {
  const SIZE = 1080;
  const PAD  = 80;

  const canvas = document.createElement('canvas');
  canvas.width  = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background — subtle radial gradient for depth
  const grad = ctx.createRadialGradient(SIZE / 2, SIZE * 0.38, 0, SIZE / 2, SIZE * 0.38, SIZE * 0.78);
  grad.addColorStop(0, '#1C1C1C');
  grad.addColorStop(1, '#0F0F0F');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  // Brand label
  ctx.fillStyle    = '#C9A84C';
  ctx.letterSpacing = '5px';
  ctx.font = '600 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('EMPIRE SIGNAL', SIZE / 2, PAD + 18);
  ctx.letterSpacing = '0px';

  // Word — scale font to fit
  const wordFontSize = word.length <= 6 ? 140 : word.length <= 10 ? 110 : word.length <= 14 ? 85 : 65;
  ctx.font      = `400 ${wordFontSize}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = '#FFFFFF';
  const wordY   = 460;
  ctx.fillText(word, SIZE / 2, wordY, SIZE - PAD * 2);

  // Accumulate Y below the word
  let y = wordY + Math.round(wordFontSize / 2) + 44;

  // Phonetic (IPA) — skip if the field contains prose instead of compact IPA
  if (essential.pronunciation.phonetic && essential.pronunciation.phonetic.length <= 45) {
    ctx.font      = '400 26px "Courier New", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText(essential.pronunciation.phonetic, SIZE / 2, y);
    y += 54;
  }

  // CEFR badge — pill shape
  if (essential.cefr) {
    const cc = CEFR_CARD_COLORS[essential.cefr] ?? { bg: 'rgba(255,255,255,0.1)', text: '#FFFFFF' };
    ctx.font = '700 19px "Courier New", monospace';
    const tw   = ctx.measureText(essential.cefr).width;
    const pH   = 36;
    const pPad = 20;
    const pW   = tw + pPad * 2;
    const pX   = SIZE / 2 - pW / 2;

    ctx.fillStyle = cc.bg;
    ctx.beginPath();
    ctx.roundRect(pX, y - pH / 2, pW, pH, pH / 2);
    ctx.fill();

    ctx.fillStyle = cc.text;
    ctx.fillText(essential.cefr, SIZE / 2, y);
    y += 56;
  }

  // Etymology — italic, 3 lines max
  if (etymology) {
    ctx.font      = 'italic 400 22px Georgia, "Times New Roman", serif';
    ctx.fillStyle = 'rgba(255,255,255,0.60)';
    const maxW = SIZE - (PAD + 60) * 2;
    const lines = wrapText(ctx, etymology, maxW, 3);
    for (const line of lines) {
      ctx.fillText(line, SIZE / 2, y);
      y += 36;
    }
  }

  // URL — bottom anchor
  ctx.fillStyle    = '#C9A84C';
  ctx.letterSpacing = '2px';
  ctx.font = '400 13px system-ui, -apple-system, sans-serif';
  ctx.fillText('empire-signal.vercel.app', SIZE / 2, SIZE - PAD);
  ctx.letterSpacing = '0px';

  // Download PNG
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `${word}-empire.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const prefix = lang.split('-')[0];
  return (
    voices.find((v) => v.name.includes('Google') && v.lang.startsWith(prefix)) ??
    voices.find((v) => v.lang.startsWith(prefix)) ??
    null
  );
}

export default function AnalysisResult({ record, cacheHit, onReset, onAnalyzeWord, user, onSignOut, hasHistory }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [wordCopied, setWordCopied] = useState(false);
  const [cardSaved, setCardSaved] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [sentence, setSentence] = useState('');
  const [validation, setValidation] = useState<ValidationState>({ status: 'idle' });
  const [question, setQuestion] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [askHistory, setAskHistory] = useState<AskItem[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { word, analysis } = record;

  useEffect(() => {
    setSpeechSupported('speechSynthesis' in window);
  }, []);

  // Cancel audio and speech synthesis when the component unmounts
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  function speakFallback() {
    if (!speechSupported) { setIsSpeaking(false); return; }
    const lang = LANG_CODE[record.language.toLowerCase()] ?? 'en-US';
    function doSpeak() {
      const utter = new SpeechSynthesisUtterance(record.word);
      utter.lang = lang;
      const voice = pickVoice(lang);
      if (voice) utter.voice = voice;
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utter);
    }
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.addEventListener('voiceschanged', doSpeak, { once: true });
    } else {
      doSpeak();
    }
  }

  async function handleListen() {
    if (isSpeaking) {
      audioRef.current?.pause();
      audioRef.current = null;
      if (speechSupported) window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);

    if (record.language.toLowerCase() === 'en') {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      try {
        const res = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(record.word)}`,
          { signal: controller.signal },
        );
        clearTimeout(timeoutId);
        if (res.ok) {
          const data: Array<{ phonetics: Array<{ audio?: string }> }> = await res.json();
          const audioUrl = data[0]?.phonetics?.find((p) => p.audio)?.audio;
          if (audioUrl) {
            try {
              const audio = new Audio(audioUrl);
              audioRef.current = audio;
              audio.onended = () => { setIsSpeaking(false); audioRef.current = null; };
              audio.onerror = () => { setIsSpeaking(false); audioRef.current = null; };
              await audio.play();
              return;
            } catch { /* play() rejected → fall through to speakFallback */ }
          }
        }
      } catch {
        clearTimeout(timeoutId);
        /* fall through to Web Speech */
      }
    }

    speakFallback();
  }

  async function handleValidate() {
    const trimmed = sentence.trim();
    if (!trimmed) return;
    setValidation({ status: 'loading' });
    try {
      const res = await fetch('/api/signal/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: trimmed, word: record.word, language: record.language.toLowerCase() }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        setValidation({ status: 'error', message: (data as { error?: string }).error ?? 'Validation failed.' });
        return;
      }
      const d = data as { natural: boolean; score: number; feedback: string; suggestion?: string };
      track('sentence_validated', { score: d.score, natural: d.natural });
      setValidation({ status: 'result', natural: d.natural, score: d.score, feedback: d.feedback, suggestion: d.suggestion });
    } catch {
      setValidation({ status: 'error', message: 'Could not connect to the server.' });
    }
  }

  async function handleAsk() {
    const trimmed = question.trim();
    if (!trimmed || askLoading || !record.id) return;
    setAskLoading(true);
    try {
      const res = await fetch('/api/signal/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchRecordId: record.id, question: trimmed }),
      });
      const data: unknown = await res.json();
      if (res.ok) {
        setAskHistory((prev) => [...prev, { question: trimmed, answer: (data as { answer: string }).answer }]);
        setQuestion('');
      }
    } catch { /* silently ignore — question input stays */ }
    finally { setAskLoading(false); }
  }

  const lang = record.language.toLowerCase() as 'en' | 'es';
  const l = LABELS[lang] ?? LABELS.en;
  const { essential, advanced } = analysis;
  const heroPhonetic = essential.pronunciation.phonetic.length <= 45
    ? essential.pronunciation.phonetic
    : null;

  return (
    <div className="min-h-screen bg-bg">

      {/* Sticky header: back left, auth right */}
      <div className="sticky top-0 z-10 border-b border-line" style={{ backgroundColor: 'var(--bg-translucent)', backdropFilter: 'blur(8px)' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors duration-150 shrink-0"
          >
            <IconBack />
            {hasHistory ? l.back : l.newSearch}
          </button>

          {user === null && (
            <div className="flex items-center gap-3 shrink-0">
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
          )}

          {user && (
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-ink-faint hidden sm:inline truncate max-w-[160px]">{user.email}</span>
              <button
                onClick={onSignOut}
                className="text-xs text-ink-muted hover:text-ink transition-colors duration-150 shrink-0"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        {/* Word hero */}
        <div className="mb-4 text-center">
          <h1
            className="text-[3.25rem] sm:text-[3.75rem] tracking-tight text-ink leading-none mb-3"
            style={{ fontFamily: 'var(--font-dm-serif)' }}
          >
            {word}
          </h1>
          {(heroPhonetic || essential.cefr) && (
            <p className="flex items-center justify-center gap-2 text-lg text-ink-faint" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              {heroPhonetic && <span>{heroPhonetic}</span>}
              {heroPhonetic && essential.cefr && <span className="select-none">·</span>}
              {essential.cefr && <CefrBadge level={essential.cefr} />}
            </p>
          )}

          {cacheHit && (
            <p className="mt-2 text-[0.65rem] font-medium tracking-widest uppercase" style={{ color: '#2E7D32' }}>
              cached
            </p>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-1 mt-5">
            <button
              className="flex items-center gap-1.5 text-sm py-2.5 px-3 text-ink-muted hover:text-accent transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={handleListen}
              disabled={!speechSupported}
              title={speechSupported ? undefined : l.notSupported}
            >
              {isSpeaking ? <IconStop /> : <IconSpeaker />}
              {isSpeaking ? l.stop : l.listen}
            </button>
            <span className="text-ink-faint select-none">·</span>
            <button
              className="flex items-center gap-1.5 text-sm py-2.5 px-3 text-ink-muted hover:text-accent transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!record.shareId}
              onClick={() => {
                const url = `${window.location.origin}/share/${record.shareId}`;
                navigator.clipboard.writeText(url).then(() => {
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2000);
                });
              }}
            >
              <IconShare />
              {shareCopied ? l.copied : l.share}
            </button>
            <span className="text-ink-faint select-none">·</span>
            <button
              className="flex items-center gap-1.5 text-sm py-2.5 px-3 text-ink-muted hover:text-accent transition-colors duration-150"
              onClick={() => {
                navigator.clipboard.writeText(word).then(() => {
                  setWordCopied(true);
                  setTimeout(() => setWordCopied(false), 1500);
                });
              }}
            >
              <IconCopy />
              {wordCopied ? l.copied : l.copy}
            </button>
            <span className="text-ink-faint select-none">·</span>
            <button
              className="flex items-center gap-1.5 text-sm py-2.5 px-3 text-ink-muted hover:text-accent transition-colors duration-150"
              onClick={() => {
                track('share_card_saved', { word });
                generateCard(word, essential, advanced.etymology);
                setCardSaved(true);
                setTimeout(() => setCardSaved(false), 1500);
              }}
            >
              <IconDownload />
              {cardSaved ? l.cardSaved : l.saveCard}
            </button>
          </div>
        </div>

        {/* Essential sections — card grid */}
        <div className="flex flex-col gap-4">

          {/* Meaning in context — accent left border */}
          <section style={{ ...cardBase, borderLeft: '4px solid var(--accent)' }}>
            <SectionLabel serif>{essential.contextNote ? l.meaningInCtx : l.meaning}</SectionLabel>
            <p className="text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {essential.meaningInContext}
            </p>
          </section>

          {/* Multiple meanings — polysemous words */}
          {essential.meanings && essential.meanings.length > 1 && (
            <section style={cardBase}>
              <SectionLabel serif>{l.meanings}</SectionLabel>
              <div className="space-y-4">
                {essential.meanings.map((m, i) => (
                  <div key={i} className={i > 0 ? 'pt-4 border-t border-line' : ''}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-[4px]"
                        style={{ background: 'var(--badge-bg)', color: 'var(--accent)', border: '1px solid var(--badge-border)' }}
                      >
                        {m.partOfSpeech}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{m.definition}</p>
                    {m.example && (
                      <p className="text-sm italic mt-1.5" style={{ color: 'var(--text-body)' }}>{m.example}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Validate your sentence */}
          <section style={{ ...cardBase, background: 'var(--surface-blue)' }}>
            <SectionLabel serif>{l.validateSection}</SectionLabel>
            <p className="text-sm text-ink-muted mb-4 -mt-1 leading-relaxed">{l.validateHint}</p>
            <textarea
              value={sentence}
              onChange={(e) => { setSentence(e.target.value); setValidation({ status: 'idle' }); }}
              placeholder={lang === 'en' ? `Write a sentence using "${word}"...` : `Escribe una oración usando "${word}"...`}
              rows={2}
              maxLength={300}
              className="w-full bg-bg border border-line rounded-lg px-4 py-3 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent resize-none transition-colors duration-150"
            />
            <button
              onClick={handleValidate}
              disabled={sentence.trim().length === 0 || validation.status === 'loading'}
              className="mt-3 w-full py-3 rounded-lg text-sm font-medium transition-colors duration-150 bg-accent text-white enabled:hover:bg-accent-hover disabled:bg-[var(--surface-muted)] disabled:text-ink-faint disabled:cursor-not-allowed"
            >
              {validation.status === 'loading' ? (
                <span className="flex items-center justify-center gap-1.5">
                  <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
                  {l.check}
                </span>
              ) : l.check}
            </button>

            {validation.status === 'result' && (
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-2xl font-semibold"
                    style={{ color: validation.natural ? '#2E7D32' : '#E65100' }}
                  >
                    {validation.score}/100
                  </span>
                  <span className="text-xs text-ink-muted">
                    {validation.natural ? l.soundsNatural : l.needsAdjust}
                  </span>
                </div>
                <p className="text-sm text-ink-muted mt-2">{validation.feedback}</p>
                {!validation.natural && validation.suggestion && (
                  <div
                    style={{
                      background: 'var(--surface-muted)',
                      borderLeft: '3px solid var(--accent)',
                      padding: '12px',
                      borderRadius: '8px',
                      marginTop: '12px',
                    }}
                  >
                    <p
                      className="text-[0.65rem] font-semibold uppercase mb-1"
                      style={{ color: 'var(--accent)', letterSpacing: '0.08em' }}
                    >
                      {l.tryInstead}
                    </p>
                    <p className="text-sm italic" style={{ color: 'var(--text-body)' }}>
                      {validation.suggestion}
                    </p>
                  </div>
                )}
              </div>
            )}

            {validation.status === 'error' && (
              <p className="mt-3 text-xs text-ink-muted">{validation.message}</p>
            )}
          </section>

          {/* In your context — only when contextNote is present */}
          {essential.contextNote && (
            <section style={{ ...cardBase, background: 'var(--surface-blue)', borderLeft: '3px solid var(--accent)' }}>
              <SectionLabel serif>{l.inYourContext}</SectionLabel>
              <p className="text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                {essential.contextNote}
              </p>
            </section>
          )}

          {/* Word type */}
          <section style={cardBase}>
            <SectionLabel serif>{l.wordType}</SectionLabel>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-[4px]"
                style={{ background: 'var(--badge-bg)', color: 'var(--accent)', border: '1px solid var(--badge-border)' }}
              >
                {essential.wordType.category}
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>
              {essential.wordType.explanation}
            </p>
          </section>

          {/* Pronunciation */}
          <section style={cardBase}>
            <SectionLabel serif>{l.pronunciation}</SectionLabel>
            {essential.pronunciation.guide.split(/(?<=\.)\s+/).map((sentence, i) => (
              <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text-body)', marginTop: i > 0 ? '6px' : 0 }}>
                {sentence}
              </p>
            ))}
          </section>

          {/* Usage examples */}
          <section style={cardBase}>
            <SectionLabel serif>{l.usageExamples}</SectionLabel>
            <div className="space-y-4">
              {essential.usageExamples.map((ex, i) => (
                <div key={i} className="flex items-start gap-3">
                  <RegisterBadge label={ex.register} />
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{ex.example}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Collocations */}
          <section style={cardBase}>
            <SectionLabel serif>{l.collocations}</SectionLabel>
            <div className="space-y-4">
              {essential.collocations.map((col, i) => (
                <div key={i}>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{col.phrase}</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>{col.meaning}</p>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Advanced toggle */}
        <div className="mt-4">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full py-4 flex items-center justify-center gap-2 text-sm text-ink-muted hover:text-ink border-y border-line transition-colors duration-150"
          >
            <span>{showAdvanced ? l.hideFull : l.viewFull}</span>
            <IconChevron open={showAdvanced} />
          </button>

          {/* Advanced sections */}
          <div
            className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${
              showAdvanced ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-4 pt-4">

                {advanced.etymology && (
                  <section style={cardBase}>
                    <SectionLabel>{l.etymology}</SectionLabel>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>
                      {advanced.etymology}
                    </p>
                  </section>
                )}

                {advanced.story && (
                  <section style={cardBase}>
                    <SectionLabel>{l.story}</SectionLabel>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>
                      {advanced.story}
                    </p>
                  </section>
                )}

                <section style={cardBase}>
                  <SectionLabel>{l.synonyms}</SectionLabel>
                  <div className="space-y-4">
                    {advanced.synonyms.map((syn, i) => (
                      <div key={i}>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          <ClickableWord word={syn.word} onAnalyze={onAnalyzeWord} />
                        </p>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>{syn.nuance}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {advanced.antonyms.length > 0 && (
                  <section style={cardBase}>
                    <SectionLabel>{l.antonyms}</SectionLabel>
                    <div className="space-y-4">
                      {advanced.antonyms.map((ant, i) => (
                        <div key={i}>
                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            <ClickableWord word={ant.word} onAnalyze={onAnalyzeWord} />
                          </p>
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>{ant.context}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section style={cardBase}>
                  <SectionLabel>{l.registerLevel}</SectionLabel>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-[4px]"
                      style={{ background: '#F0F0EE', color: '#1A1A1A', border: '1px solid #EAEAE6' }}
                    >
                      {advanced.registerLevel.level}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>
                    {advanced.registerLevel.guidance}
                  </p>
                </section>

                <section style={{ ...cardBase, background: 'var(--surface-error)' }}>
                  <SectionLabel>{l.commonErrors}</SectionLabel>
                  <div className="space-y-5">
                    {advanced.commonErrors.map((ce, i) => (
                      <div key={i}>
                        <p className="text-sm mb-1.5" style={{ color: '#C0392B' }}>
                          {ce.error}
                        </p>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>
                          → {ce.correction}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section style={cardBase}>
                  <SectionLabel>{l.wordFamily}</SectionLabel>
                  <div className="space-y-4">
                    {advanced.wordFamily.map((wf, i) => (
                      <div key={i}>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          <ClickableWord word={wf.word} onAnalyze={onAnalyzeWord} />
                        </p>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>{wf.relation}</p>
                      </div>
                    ))}
                  </div>
                </section>

              </div>
            </div>
          </div>
        </div>

        {/* Follow-up questions */}
        {record.id && (
          <section className="mt-4" style={cardBase}>
            <SectionLabel serif>{l.askSection}</SectionLabel>

            {askHistory.length > 0 && (
              <div className="mb-4 space-y-5">
                {askHistory.map((item, i) => (
                  <div key={i}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: '#3A3D8F' }}>{item.question}</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>{item.answer}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
                placeholder={lang === 'en' ? `Ask anything about "${word}"...` : `Pregunta lo que quieras sobre "${word}"...`}
                maxLength={500}
                className="flex-1 min-w-0 bg-bg border border-line rounded-lg px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent transition-colors duration-150"
              />
              <button
                onClick={handleAsk}
                disabled={question.trim().length === 0 || askLoading}
                className="shrink-0 px-4 py-2.5 rounded-[6px] text-xs font-medium border border-line text-ink-muted enabled:hover:text-ink enabled:hover:border-ink-muted transition-all duration-150 disabled:bg-[var(--surface-muted)] disabled:text-ink-faint disabled:cursor-not-allowed"
              >
                {askLoading ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border border-line border-t-accent rounded-full animate-spin" />
                    {l.asking}
                  </span>
                ) : l.askBtn}
              </button>
            </div>
          </section>
        )}

        {/* Bottom reset */}
        <div className="mt-16 pb-8 text-center">
          <button
            onClick={onReset}
            className="text-sm text-ink-faint hover:text-ink-muted transition-colors duration-150"
          >
            {l.analyzeAnother}
          </button>
        </div>
      </div>
    </div>
  );
}
