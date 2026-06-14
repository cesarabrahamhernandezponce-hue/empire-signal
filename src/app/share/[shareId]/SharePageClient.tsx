'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AnalysisResult, { type AnalyzeRecord } from '@/components/AnalysisResult';

type PageState =
  | { status: 'loading' }
  | { status: 'result'; record: AnalyzeRecord }
  | { status: 'not-found' }
  | { status: 'error' };

export default function SharePageClient({ shareId }: { shareId: string }) {
  const router = useRouter();
  const [state, setState] = useState<PageState>({ status: 'loading' });

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

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-5 h-5 border-2 border-line border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-ink-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (state.status === 'not-found') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-sm text-ink mb-1">Analysis not found</p>
          <p className="text-sm text-ink-muted mb-6">This link may have expired or never existed.</p>
          <button
            onClick={() => router.push('/')}
            className="text-sm text-accent hover:text-accent-hover transition-colors duration-150"
          >
            ← Back to Empire Signal
          </button>
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-sm text-ink mb-1">Something went wrong</p>
          <p className="text-sm text-ink-muted mb-6">Could not load this analysis.</p>
          <button
            onClick={() => router.push('/')}
            className="text-sm text-accent hover:text-accent-hover transition-colors duration-150"
          >
            ← Back to Empire Signal
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
