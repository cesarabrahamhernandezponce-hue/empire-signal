'use client';

import { useState } from 'react';
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
}

const cardBase: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: '12px',
  border: '1px solid #EAEAE6',
  padding: '24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-3 text-[0.75rem] font-semibold uppercase"
      style={{ color: '#3A3D8F', letterSpacing: '0.05em' }}
    >
      {children}
    </p>
  );
}

function RegisterBadge({ label }: { label: string }) {
  return (
    <span
      className="shrink-0 text-[0.6rem] font-semibold uppercase rounded-[4px] px-1.5 py-0.5"
      style={{ background: '#F0F0EE', color: '#1A1A1A', letterSpacing: '0.08em' }}
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
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 5H5L9 2V12L5 9H2V5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M11 4.5C11.9 5.4 12.5 6.1 12.5 7C12.5 7.9 11.9 8.6 11 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M6 2H3C2.4 2 2 2.4 2 3V11C2 11.6 2.4 12 3 12H11C11.6 12 12 11.6 12 11V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9 2H12V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 7L12 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function IconCopy() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
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

export default function AnalysisResult({ record, onReset }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const { word, analysis } = record;
  const { essential, advanced } = analysis;

  return (
    <div className="min-h-screen bg-bg">

      {/* Sticky top nav */}
      <div className="sticky top-0 z-10 border-b border-line" style={{ backgroundColor: 'rgba(250,250,248,0.92)', backdropFilter: 'blur(8px)' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors duration-150"
          >
            <IconBack />
            New search
          </button>
          <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-ink-faint">
            Empire Signal
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

        {/* Word hero — untouched */}
        <div className="mb-12 text-center">
          <h1 className="text-[3.25rem] sm:text-[3.75rem] font-bold tracking-tight text-ink leading-none mb-3">
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
          <div className="flex items-center justify-center gap-5 mt-6">
            <button
              className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-accent transition-colors duration-150"
              disabled
              title="Coming soon"
            >
              <IconSpeaker />
              Listen
            </button>
            <button
              className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-accent transition-colors duration-150"
              onClick={() => {
                const url = `${window.location.origin}/share/${record.shareId}`;
                navigator.clipboard.writeText(url).then(() => {
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2000);
                });
              }}
            >
              <IconShare />
              {shareCopied ? 'Copied!' : 'Share'}
            </button>
            <button
              className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-accent transition-colors duration-150"
              onClick={() => navigator.clipboard.writeText(word)}
            >
              <IconCopy />
              Copy
            </button>
          </div>
        </div>

        {/* Essential sections — card grid */}
        <div className="flex flex-col gap-4">

          {/* Meaning in context — accent left border */}
          <section style={{ ...cardBase, borderLeft: '3px solid #3A3D8F' }}>
            <SectionLabel>Meaning in context</SectionLabel>
            <p className="text-base leading-relaxed" style={{ color: '#1A1A1A' }}>
              {essential.meaningInContext}
            </p>
          </section>

          {/* Word type */}
          <section style={cardBase}>
            <SectionLabel>Word type</SectionLabel>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-[4px]"
                style={{ background: '#F0F0EE', color: '#1A1A1A', border: '1px solid #EAEAE6' }}
              >
                {essential.wordType.category}
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>
              {essential.wordType.explanation}
            </p>
          </section>

          {/* Pronunciation */}
          <section style={cardBase}>
            <SectionLabel>Pronunciation</SectionLabel>
            <p className="text-sm leading-relaxed" style={{ color: '#1A1A1A' }}>
              {essential.pronunciation.guide}
            </p>
          </section>

          {/* Usage examples */}
          <section style={cardBase}>
            <SectionLabel>Usage examples</SectionLabel>
            <div className="space-y-4">
              {essential.usageExamples.map((ex, i) => (
                <div key={i} className="flex items-start gap-3">
                  <RegisterBadge label={ex.register} />
                  <p className="text-sm leading-relaxed" style={{ color: '#1A1A1A' }}>{ex.example}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Collocations */}
          <section style={cardBase}>
            <SectionLabel>Collocations</SectionLabel>
            <div className="space-y-3">
              {essential.collocations.map((col, i) => (
                <div key={i} className="flex gap-4">
                  <span className="shrink-0 text-sm font-medium w-40" style={{ color: '#1A1A1A' }}>
                    {col.phrase}
                  </span>
                  <span className="text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>
                    {col.meaning}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Mnemonic — blue-tinted background */}
          <section style={{ ...cardBase, background: '#F5F5FB' }}>
            <SectionLabel>Mnemonic</SectionLabel>
            <p className="text-sm leading-relaxed italic" style={{ color: '#4A4A4A' }}>
              {essential.mnemonic}
            </p>
          </section>

        </div>

        {/* Advanced toggle */}
        <div className="mt-4">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full py-4 flex items-center justify-center gap-2 text-sm text-ink-muted hover:text-ink border-y border-line transition-colors duration-150"
          >
            <span>{showAdvanced ? 'Hide full analysis' : 'View full analysis'}</span>
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
                    <SectionLabel>Etymology</SectionLabel>
                    <p className="text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>
                      {advanced.etymology}
                    </p>
                  </section>
                )}

                {advanced.story && (
                  <section style={cardBase}>
                    <SectionLabel>The story behind</SectionLabel>
                    <p className="text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>
                      {advanced.story}
                    </p>
                  </section>
                )}

                <section style={cardBase}>
                  <SectionLabel>Synonyms</SectionLabel>
                  <div className="space-y-3">
                    {advanced.synonyms.map((syn, i) => (
                      <div key={i} className="flex gap-4">
                        <span className="shrink-0 text-sm font-medium w-28" style={{ color: '#1A1A1A' }}>
                          {syn.word}
                        </span>
                        <span className="text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>
                          {syn.nuance}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {advanced.antonyms.length > 0 && (
                  <section style={cardBase}>
                    <SectionLabel>Antonyms</SectionLabel>
                    <div className="space-y-3">
                      {advanced.antonyms.map((ant, i) => (
                        <div key={i} className="flex gap-4">
                          <span className="shrink-0 text-sm font-medium w-28" style={{ color: '#1A1A1A' }}>
                            {ant.word}
                          </span>
                          <span className="text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>
                            {ant.context}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section style={cardBase}>
                  <SectionLabel>Register level</SectionLabel>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-[4px]"
                      style={{ background: '#F0F0EE', color: '#1A1A1A', border: '1px solid #EAEAE6' }}
                    >
                      {advanced.registerLevel.level}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>
                    {advanced.registerLevel.guidance}
                  </p>
                </section>

                <section style={cardBase}>
                  <SectionLabel>Common errors</SectionLabel>
                  <div className="space-y-5">
                    {advanced.commonErrors.map((ce, i) => (
                      <div key={i}>
                        <p className="text-sm line-through decoration-red-400 mb-1.5" style={{ color: '#1A1A1A' }}>
                          {ce.error}
                        </p>
                        <p className="text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>
                          → {ce.correction}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section style={cardBase}>
                  <SectionLabel>Word family</SectionLabel>
                  <div className="space-y-3">
                    {advanced.wordFamily.map((wf, i) => (
                      <div key={i} className="flex gap-4">
                        <span className="shrink-0 text-sm font-medium w-28" style={{ color: '#1A1A1A' }}>
                          {wf.word}
                        </span>
                        <span className="text-sm leading-relaxed" style={{ color: '#4A4A4A' }}>
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
            ← Analyze another word
          </button>
        </div>
      </div>
    </div>
  );
}
