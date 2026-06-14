import type { Metadata } from 'next';

import { getAnalysisByShareId } from '@/lib/services/signal';
import SharePageClient from './SharePageClient';

export async function generateMetadata(
  { params }: { params: Promise<{ shareId: string }> },
): Promise<Metadata> {
  const { shareId } = await params;
  const result = await getAnalysisByShareId(shareId);

  if (!result.ok) {
    return {
      title: 'Analysis not found',
      description: 'This link may have expired or never existed.',
    };
  }

  const { word, language, analysis } = result.record;
  const meaning = analysis?.essential?.meaningInContext?.trim();
  const isEs = language === 'ES';
  const description = meaning
    ? meaning
    : isEs
      ? `Análisis lingüístico de “${word}” en Empire Signal.`
      : `Linguistic analysis of “${word}” on Empire Signal.`;

  return {
    title: word,
    description,
    openGraph: {
      type: 'article',
      title: `${word} — Empire Signal`,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${word} — Empire Signal`,
      description,
    },
  };
}

export default async function SharePage(
  { params }: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await params;
  return <SharePageClient shareId={shareId} />;
}
