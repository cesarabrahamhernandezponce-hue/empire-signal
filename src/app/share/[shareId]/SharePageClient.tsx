'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AnalysisResult, { type AnalyzeRecord } from '@/components/AnalysisResult';

type PageState =
  | { status: 'loading' }
  | { status: 'result'; record: AnalyzeRecord }
  | { status: 'not-found' }
  | { status: 'error' };

type UiLang = 'en' | 'es';

const COPY: Record<UiLang, {
  loading: string;
  notFoundTitle: string;
  notFoundBody: string;
  errorTitle: string;
  errorBody: string;
  back: string;
}> = {
  en: {
    loading:       'Loading...',
    notFoundTitle: 'Analysis not found',
    notFoundBody:  'This link may have expired or never existed.',
    errorTitle:    'Something went wrong',
    errorBody:     'Could not load this analysis.',
    back:          '← Back to Empire Signal',
  },
  es: {
    loading:       'Cargando...',
    notFoundTitle: 'Análisis no encontrado',
    notFoundBody:  'Este enlace pudo haber expirado o nunca existió.',
    errorTitle:    'Algo salió mal',
    errorBody:     'No se pudo cargar este análisis.',
    back:          '← Volver a Empire Signal',
  },
};

export default function SharePageClient({ shareId }: { shareId: string }) {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ status: 'loading' });
  const [uiLang] = useState<UiLang>(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('language') === 'es') return 'es';
    return 'en';
  });

  useEffect(() => {
    fetch(`/api/signal/share/${shareId}`)
      .then((res) => {
        if (res.status === 404) { setState({ status: 'not-found' }); return null; }
        if (!res.ok)            { setState({ status: 'error' });     return null; }
        return res.json();
      })
      .then((data: { record: AnalyzeRecord } | null) => {
        if (data) setState({ status: 'result', record: data.record });
      })
      .catch(() => setState({ status: 'error' }));
  }, [shareId]);

  const c = COPY[uiLang];

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-5 h-5 border-2 border-line border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-ink-muted">{c.loading}</p>
        </div>
      </div>
    );
  }

  if (state.status === 'not-found') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-sm text-ink mb-1">{c.notFoundTitle}</p>
          <p className="text-sm text-ink-muted mb-6">{c.notFoundBody}</p>
          <button
            onClick={() => router.push('/')}
            className="text-sm text-accent hover:text-accent-hover transition-colors duration-150"
          >
            {c.back}
          </button>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-sm text-ink mb-1">{c.errorTitle}</p>
          <p className="text-sm text-ink-muted mb-6">{c.errorBody}</p>
          <button
            onClick={() => router.push('/')}
            className="text-sm text-accent hover:text-accent-hover transition-colors duration-150"
          >
            {c.back}
          </button>
        </div>
      </div>
    );
  }

  return (
    <AnalysisResult
      record={state.record}
      onReset={() => router.push('/')}
      uiLang={state.record.language.toLowerCase() as 'en' | 'es'}
      interactive={false}
    />
  );
}
