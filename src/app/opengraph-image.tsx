import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'Empire Signal — linguistic intelligence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BRAND_GRADIENT = 'linear-gradient(90deg, #3A3D8F 0%, #5B5FCF 100%)';

export default async function Image() {
  const fontDir = join(process.cwd(), 'src/app/_og-fonts');
  const [serifRegular, serifItalic] = await Promise.all([
    readFile(join(fontDir, 'DMSerifDisplay-Regular.ttf')),
    readFile(join(fontDir, 'DMSerifDisplay-Italic.ttf')),
  ]);

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
          background: '#FAFAF8',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontFamily: 'DM Serif Display',
              fontStyle: 'italic',
              fontSize: 132,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              paddingRight: '0.12em',
              backgroundImage: BRAND_GRADIENT,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
            }}
          >
            Empire
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 16,
              paddingLeft: '0.42em',
              fontSize: 38,
              fontWeight: 600,
              letterSpacing: '0.42em',
              textTransform: 'uppercase',
              color: '#6B6B6B',
            }}
          >
            Signal
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 52,
            fontFamily: 'DM Serif Display',
            fontSize: 46,
            lineHeight: 1.3,
            color: '#1A1A1A',
          }}
        >
          You know the word. But do you know how to use it?
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'DM Serif Display', data: serifRegular, style: 'normal', weight: 400 },
        { name: 'DM Serif Display', data: serifItalic, style: 'italic', weight: 400 },
      ],
    },
  );
}
