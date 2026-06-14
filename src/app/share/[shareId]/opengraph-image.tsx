import { ImageResponse } from 'next/og';

import { getAnalysisByShareId } from '@/lib/services/signal';

export const alt = 'Empire Signal — linguistic analysis';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image(
  { params }: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await params;
  const result = await getAnalysisByShareId(shareId);

  const word = result.ok ? result.record.word : 'Empire Signal';
  const rawMeaning = result.ok ? result.record.analysis?.essential?.meaningInContext?.trim() : '';
  const meaning = rawMeaning && rawMeaning.length > 160 ? `${rawMeaning.slice(0, 157)}…` : rawMeaning;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#0f0f0f',
          color: '#f5f5f0',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, fontStyle: 'italic', letterSpacing: '-0.01em', color: '#c9a96a' }}>
          Empire Signal
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 110, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            {word}
          </div>
          {meaning ? (
            <div style={{ display: 'flex', marginTop: 28, fontSize: 38, lineHeight: 1.3, color: '#b8b8b0' }}>
              {meaning}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', fontSize: 26, color: '#7a7a72' }}>
          Linguistic intelligence
        </div>
      </div>
    ),
    { ...size },
  );
}
