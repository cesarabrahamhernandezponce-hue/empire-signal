import { ImageResponse } from 'next/og';

export const alt = 'Empire Signal — linguistic intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: '#0f0f0f',
          color: '#f5f5f0',
        }}
      >
        <div style={{ display: 'flex', fontSize: 96, fontStyle: 'italic', fontWeight: 700, letterSpacing: '-0.03em', color: '#c9a96a' }}>
          Empire Signal
        </div>
        <div style={{ display: 'flex', marginTop: 24, fontSize: 42, lineHeight: 1.3, color: '#b8b8b0' }}>
          You know the word. But do you know how to use it?
        </div>
      </div>
    ),
    { ...size },
  );
}
