'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { track } from '@/lib/analytics';

const BRAND_GRADIENT = 'linear-gradient(90deg, #3A3D8F 0%, #5B5FCF 100%)';
const STORAGE_KEY = 'es_onboarded';
const SHOW_DELAY_MS = 600;

// localStorage can throw (privacy modes, disabled storage); never let that
// break the render — treat any failure as "not yet onboarded".
function hasOnboarded(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export default function OnboardingModal({
  user,
  onSeeExample,
}: {
  user: User | null | undefined;
  onSeeExample: () => void;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Only surface onboarding once auth has resolved to an anonymous visitor who
  // hasn't seen it before. undefined = auth unresolved (wait), truthy = signed in.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasOnboarded()) return;
    if (user === undefined) return;
    if (user) return;
    const id = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(id);
  }, [user]);

  const markOnboarded = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    setOpen(false);
  }, []);

  // Dismissed without engaging. `method` distinguishes the deliberate "Skip"
  // link from an incidental backdrop/Escape close, so the onboarding funnel
  // (shown → skipped vs. shown → example) can be measured.
  const skip = useCallback(
    (method: 'button' | 'backdrop' | 'escape') => {
      track('onboarding_skipped', { method });
      markOnboarded();
    },
    [markOnboarded],
  );

  const handleExample = useCallback(() => {
    markOnboarded();
    onSeeExample();
  }, [markOnboarded, onSeeExample]);

  // Focus trap + Escape, active only while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const node = dialogRef.current;
    if (!node) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const getFocusable = () =>
      Array.from(
        node.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'));

    getFocusable()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skip('escape');
        return;
      }
      if (e.key !== 'Tab') return;
      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, skip]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={() => skip('backdrop')}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0,0,0,0.45)',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-desc"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          padding: '32px 28px',
          maxWidth: '400px',
          width: '100%',
          textAlign: 'center',
          animation: 'lensRise 0.25s ease',
        }}
      >
        <div id="onboarding-title" style={{ marginBottom: '18px' }}>
          <span
            style={{
              display: 'inline-block',
              fontFamily: 'var(--font-dm-serif)',
              fontStyle: 'italic',
              fontSize: '1.6rem',
              lineHeight: 1,
              letterSpacing: '-0.01em',
              backgroundImage: BRAND_GRADIENT,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              paddingRight: '0.12em',
            }}
          >
            Empire
          </span>
          <span
            style={{
              display: 'block',
              fontFamily: 'var(--font-geist-sans)',
              fontSize: '0.56rem',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              lineHeight: 1,
              letterSpacing: '0.42em',
              paddingLeft: '0.42em',
              marginTop: '6px',
            }}
          >
            Signal
          </span>
        </div>

        <p
          id="onboarding-desc"
          style={{
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            marginBottom: '24px',
          }}
        >
          Most apps tell you what a word means. Empire Signal shows you how to
          actually use it — register, collocations, real errors learners make.
        </p>

        <button
          type="button"
          onClick={handleExample}
          className="w-full cursor-pointer rounded-[10px] bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.99]"
        >
          See a real example →
        </button>

        <button
          type="button"
          onClick={() => skip('button')}
          className="mx-auto mt-3.5 block cursor-pointer border-0 bg-transparent text-xs text-ink-faint transition-colors hover:text-ink-muted"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
