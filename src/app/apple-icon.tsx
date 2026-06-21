import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const BRAND_GRADIENT = 'linear-gradient(135deg, #3A3D8F 0%, #5B5FCF 100%)';

export default async function AppleIcon() {
  const serifItalic = await readFile(
    join(process.cwd(), 'src/app/_og-fonts', 'DMSerifDisplay-Italic.ttf'),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: BRAND_GRADIENT,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: 'DM Serif Display',
            fontStyle: 'italic',
            fontSize: 130,
            lineHeight: 1,
            color: '#FAFAF8',
            paddingRight: '0.06em',
          }}
        >
          E
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'DM Serif Display', data: serifItalic, style: 'italic', weight: 400 }],
    },
  );
}
