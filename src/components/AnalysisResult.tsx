'use client';

import { useState, useRef, useEffect } from 'react';
import type { Analysis } from '@/lib/ai/schemas/analysis';

export type AnalyzeRecord = {
  id: string;
  word: string;
  context: string | null;
  tone: string;
  language: string;
  analysis: Analysis;
  shareId: string;
};

interface Props {
  record: AnalyzeRecord;
  onReset: () => void;
  onAnalyzeWord?: (word: string) => void;
}

const cardBase: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: '12px',
  border: '1px solid var(--border)',
  padding: '24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

function SectionLabel({ children, serif }: { children: React.ReactNode; serif?: boolean }) {
  return (
    <p
      className="mb-3 text-[0.75rem] font-semibold uppercase"
      style={{ color: '#3A3D8F', letterSpacing: '0.05em', fontFamily: serif ? 'var(--font-dm-serif)' : undefined }}
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
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 5H5L9 2V12L5 9H2V5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M11 4.5C11.9 5.4 12.5 6.1 12.5 7C12.5 7.9 11.9 8.6 11 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconStop() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="1" fill="currentColor" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M6 2H3C2.4 2 2 2.4 2 3V11C2 11.6 2.4 12 3 12H11C11.6 12 12 11.6 12 11V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9 2H12V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7L12 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="5" y="5" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 9V3C2 2.4 2.4 2 3 2H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
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
    listen:          'Listen',
    stop:            'Stop',
    share:           'Share',
    copied:          'Copied!',
    copy:            'Copy',
    meaningInCtx:    'Meaning in context',
    wordType:        'Word type',
    pronunciation:   'Pronunciation',
    usageExamples:   'Usage examples',
    collocations:    'Collocations',
    mnemonic:        'Mnemonic',
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
    check:           'Check',
    soundsNatural:   'Sounds natural',
    needsAdjust:     'Needs adjustment',
    tryInstead:      'Try instead',
  },
  es: {
    newSearch:       'Nueva búsqueda',
    listen:          'Escuchar',
    stop:            'Detener',
    share:           'Compartir',
    copied:          '¡Copiado!',
    copy:            'Copiar',
    meaningInCtx:    'Significado en contexto',
    wordType:        'Tipo de palabra',
    pronunciation:   'Pronunciación',
    usageExamples:   'Ejemplos de uso',
    collocations:    'Colocaciones',
    mnemonic:        'Mnemotécnico',
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
    check:           'Verificar',
    soundsNatural:   'Suena natural',
    needsAdjust:     'Necesita ajuste',
    tryInstead:      'Intenta así',
  },
} as const;

type ValidationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; natural: boolean; score: number; feedback: string; suggestion?: string }
  | { status: 'error'; message: string };

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const prefix = lang.split('-')[0];
  return (
    voices.find((v) => v.name.includes('Google') && v.lang.startsWith(prefix)) ??
    voices.find((v) => v.lang.startsWith(prefix)) ??
    null
  );
}

export default function AnalysisResult({ record, onReset, onAnalyzeWord }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [sentence, setSentence] = useState('');
  const [validation, setValidation] = useState<ValidationState>({ status: 'idle' });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { word, analysis } = record;

  useEffect(() => {
    setSpeechSupported('speechSynthesis' in window);
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
      try {
        const res = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(record.word)}`
        );
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
      } catch { /* fall through to Web Speech */ }
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
        body: JSON.stringify({ sentence: trimmed, word: record.word, language: record.language }),
      });
      const data: unknown = await res.json();
      if (!res.ok) {
        setValidation({ status: 'error', message: (data as { error?: string }).error ?? 'Validation failed.' });
        return;
      }
      const d = data as { natural: boolean; score: number; feedback: string; suggestion?: string };
      setValidation({ status: 'result', natural: d.natural, score: d.score, feedback: d.feedback, suggestion: d.suggestion });
    } catch {
      setValidation({ status: 'error', message: 'Could not connect to the server.' });
    }
  }

  const lang = record.language.toLowerCase() as 'en' | 'es';
  const l = LABELS[lang] ?? LABELS.en;
  const { essential, advanced } = analysis;

  return (
    <div className="min-h-screen bg-bg">

      {/* Sticky top nav */}
      <div className="sticky top-0 z-10 border-b border-line" style={{ backgroundColor: 'var(--bg-translucent)', backdropFilter: 'blur(8px)' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors duration-150"
          >
            <IconBack />
            {l.newSearch}
          </button>
          <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-ink-faint">
            Empire Signal
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        {/* Word hero — untouched */}
        <div className="mb-12 text-center">
          <h1
            className="text-[3.25rem] sm:text-[3.75rem] tracking-tight text-ink leading-none mb-3"
            style={{ fontFamily: 'var(--font-dm-serif)' }}
          >
            {word}
          </h1>
          {essential.pronunciation.phonetic && (
            <p
              className="text-lg text-ink-faint"
              style={{ fontFamily: 'var(--font-geist-mono)' }}
            >
              {essential.pronunciation.phonetic}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-accent transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={handleListen}
              disabled={!speechSupported}
              title={speechSupported ? undefined : l.notSupported}
            >
              {isSpeaking ? <IconStop /> : <IconSpeaker />}
              {isSpeaking ? l.stop : l.listen}
            </button>
            <span className="text-ink-faint select-none">·</span>
            <button
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-accent transition-colors duration-150"
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
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-accent transition-colors duration-150"
              onClick={() => navigator.clipboard.writeText(word)}
            >
              <IconCopy />
              {l.copy}
            </button>
          </div>
        </div>

        {/* Essential sections — card grid */}
        <div className="flex flex-col gap-4">

          {/* Meaning in context — accent left border */}
          <section style={{ ...cardBase, background: 'var(--surface-blue)', borderLeft: '3px solid var(--accent)' }}>
            <SectionLabel serif>{l.meaningInCtx}</SectionLabel>
            <p className="text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {essential.meaningInContext}
            </p>
          </section>

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
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {essential.pronunciation.guide}
            </p>
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
            <div>
              {essential.collocations.map((col, i) => (
                <div
                  key={i}
                  className="flex gap-4"
                  style={{ background: i % 2 !== 0 ? 'var(--bg)' : 'transparent', padding: '6px 4px', borderRadius: '4px' }}
                >
                  <span className="shrink-0 text-sm font-medium w-40" style={{ color: 'var(--text-primary)' }}>
                    <ClickableWord word={col.phrase.split(' ')[0]} onAnalyze={onAnalyzeWord} />
                    {col.phrase.includes(' ') ? col.phrase.slice(col.phrase.indexOf(' ')) : ''}
                  </span>
                  <span className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>
                    {col.meaning}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Mnemonic — blue-tinted background */}
          <section style={{ ...cardBase, background: 'var(--surface-muted)' }}>
            <SectionLabel serif>{l.mnemonic}</SectionLabel>
            <p className="leading-relaxed italic" style={{ color: '#4A4A4A', fontSize: '1rem' }}>
              <span style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '2rem', lineHeight: 1, color: '#3A3D8F', verticalAlign: '-0.3em', marginRight: '0.15em' }}>{'“'}</span>
              {essential.mnemonic}
              <span style={{ fontFamily: 'var(--font-dm-serif)', fontSize: '2rem', lineHeight: 1, color: '#3A3D8F', verticalAlign: '-0.3em', marginLeft: '0.15em' }}>{'”'}</span>
            </p>
          </section>

          {/* Validate your sentence */}
          <section style={cardBase}>
            <SectionLabel serif>{l.validateSection}</SectionLabel>
            <textarea
              value={sentence}
              onChange={(e) => { setSentence(e.target.value); setValidation({ status: 'idle' }); }}
              placeholder={lang === 'en' ? `Write a sentence using "${word}"...` : `Escribe una oración usando "${word}"...`}
              rows={2}
              maxLength={300}
              className="w-full bg-bg border border-line rounded-lg px-4 py-3 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-accent resize-none transition-colors duration-150"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleValidate}
                disabled={sentence.trim().length === 0 || validation.status === 'loading'}
                className="px-4 py-1.5 rounded-[6px] text-xs font-medium border border-line text-ink-muted hover:text-ink hover:border-ink-muted transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {validation.status === 'loading' ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 border border-line border-t-accent rounded-full animate-spin" />
                    {l.check}
                  </span>
                ) : l.check}
              </button>
            </div>

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
                      background: '#F5F5FB',
                      borderLeft: '3px solid #3A3D8F',
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
                  <div className="space-y-3">
                    {advanced.synonyms.map((syn, i) => (
                      <div key={i} className="flex gap-4">
                        <span className="shrink-0 text-sm font-medium w-28" style={{ color: 'var(--text-primary)' }}>
                          <ClickableWord word={syn.word} onAnalyze={onAnalyzeWord} />
                        </span>
                        <span className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>
                          {syn.nuance}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {advanced.antonyms.length > 0 && (
                  <section style={cardBase}>
                    <SectionLabel>{l.antonyms}</SectionLabel>
                    <div className="space-y-3">
                      {advanced.antonyms.map((ant, i) => (
                        <div key={i} className="flex gap-4">
                          <span className="shrink-0 text-sm font-medium w-28" style={{ color: 'var(--text-primary)' }}>
                            <ClickableWord word={ant.word} onAnalyze={onAnalyzeWord} />
                          </span>
                          <span className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>
                            {ant.context}
                          </span>
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
                        <p className="text-sm mb-1.5" style={{ color: '#C0392B', textDecoration: 'line-through' }}>
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
                  <div className="space-y-3">
                    {advanced.wordFamily.map((wf, i) => (
                      <div key={i} className="flex gap-4">
                        <span className="shrink-0 text-sm font-medium w-28" style={{ color: 'var(--text-primary)' }}>
                          <ClickableWord word={wf.word} onAnalyze={onAnalyzeWord} />
                        </span>
                        <span className="text-sm leading-relaxed" style={{ color: 'var(--text-body)' }}>
                          {wf.relation}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

              </div>
            </div>
          </div>
        </div>

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
