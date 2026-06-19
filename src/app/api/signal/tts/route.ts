import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getClientIp, hashIp, checkDbLimit } from '@/lib/rate-limit';
import { isOwnerRequest } from '@/lib/api-guard';

// Generous per-IP cap: audio carries no AI cost, the limit only stops someone
// scripting this route as a free TTS proxy. Browser caching (immutable response
// below) means repeat listens of the same word never reach the server, so a real
// learner won't approach it.
const DAILY_LIMIT = 100;

const querySchema = z.object({
  // Single words / short phrases only. Google's TTS endpoint truncates long
  // input anyway, and the cap keeps this from being abused as a general proxy.
  word: z.string().min(1).max(50).trim(),
  lang: z.enum(['en', 'es']),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      word: url.searchParams.get('word'),
      lang: url.searchParams.get('lang'),
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { error: `Invalid parameters: ${first.path.join('.') || 'query'} — ${first.message}` },
        { status: 400 },
      );
    }

    const { word, lang } = parsed.data;

    if (!isOwnerRequest(request)) {
      const ipHash = hashIp(getClientIp(request));
      if (!(await checkDbLimit('tts', ipHash, DAILY_LIMIT))) {
        return NextResponse.json({ error: 'Daily limit reached. Come back tomorrow.' }, { status: 429 });
      }
    }

    // Google Translate's unofficial TTS endpoint. `client=tw-ob` is the variant
    // that returns a plain mp3 without a token; it rejects requests without a
    // browser-like User-Agent. Unofficial and could change — failures here fall
    // back to the browser's own speech synthesis on the client.
    const ttsUrl =
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(word)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    let upstream: Response;
    try {
      upstream = await fetch(ttsUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://translate.google.com/' },
      });
    } catch {
      return NextResponse.json({ error: 'Audio service unavailable.' }, { status: 502 });
    } finally {
      clearTimeout(timeoutId);
    }

    const contentType = upstream.headers.get('content-type') ?? '';
    if (!upstream.ok || !contentType.includes('audio')) {
      return NextResponse.json({ error: 'Audio service unavailable.' }, { status: 502 });
    }

    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        // A word's pronunciation never changes — let the browser/CDN cache it
        // hard so repeat listens don't re-hit this route.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('[GET /api/signal/tts] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
