import { NextResponse } from 'next/server';
import { Language as DbLanguage } from '@prisma/client';

import { findCachedByKey, toLookupKey } from '@/lib/services/signal';
import { wordOfTheDay, type WodLanguage } from '@/lib/word-of-day';

const LANGUAGE_DB: Record<WodLanguage, DbLanguage> = {
  es: DbLanguage.ES,
  en: DbLanguage.EN,
};

// Word of the Day is a FREE daily feature, not a user-initiated search:
//   • The word is computed server-side from a fixed list (the client can't ask
//     for an arbitrary word), so this can never be abused to analyze something
//     off-list for free.
//   • It resolves ONLY from the SearchRecord cache (pre-populated by
//     scripts/precache/word-of-day.ts). It NEVER triggers a live AI call.
//   • It writes NO SearchEvent and runs NO rate-limit check, so it cannot count
//     against anonymous daily or registered monthly limits — same end result as
//     the owner bypass, achieved by simply not metering this path at all.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const langParam = url.searchParams.get('language');
  const language: WodLanguage = langParam === 'es' ? 'es' : 'en';

  const word = wordOfTheDay(language);
  const dbLanguage = LANGUAGE_DB[language];

  let cached;
  try {
    cached = await findCachedByKey(toLookupKey(word), dbLanguage);
  } catch (err) {
    console.error('[GET /api/signal/word-of-day] Cache lookup failed:', err);
    return NextResponse.json(
      { error: 'word_of_day_unavailable', word, language },
      { status: 503 },
    );
  }

  if (!cached) {
    // Guaranteed-cache-hit invariant broken — almost certainly the seed list was
    // edited without re-running scripts/precache/word-of-day.ts. Fail loudly in
    // the logs but DO NOT fall back to a live AI call: this feature must never
    // put a user in front of model latency or a quota timeout.
    console.warn(
      `[word-of-day] MISS for "${word}" (${language}). ` +
        'Run: node --env-file=.env.local scripts/precache/word-of-day.ts',
    );
    return NextResponse.json(
      { error: 'word_of_day_unavailable', word, language },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { record: cached, word: cached.word, language, cacheHit: true },
    { status: 200 },
  );
}
