'use client';

import { useState } from 'react';
import Link from 'next/link';

type UiLang = 'en' | 'es';

const COPY: Record<UiLang, { title: string; body: string; back: string }> = {
  en: {
    title: 'Page not found',
    body:  'This page may have moved or never existed.',
    back:  '← Back to Empire Signal',
  },
  es: {
    title: 'Página no encontrada',
    body:  'Esta página pudo haberse movido o nunca existió.',
    back:  '← Volver a Empire Signal',
  },
};

export default function NotFound() {
  const [uiLang] = useState<UiLang>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('language') === 'es') return 'es';
    return 'en';
  });

  const c = COPY[uiLang];

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p
          className="text-lg text-ink mb-4"
          style={{ fontFamily: 'var(--font-dm-serif)' }}
        >
          Empire Signal
        </p>
        <p className="text-sm font-medium text-ink mb-1">{c.title}</p>
        <p className="text-sm text-ink-muted mb-6">{c.body}</p>
        <Link
          href="/"
          className="text-sm text-accent hover:text-accent-hover transition-colors duration-150"
        >
          {c.back}
        </Link>
      </div>
    </div>
  );
}
