#!/usr/bin/env node
// Pre-generate every Word-of-the-Day analysis UP FRONT, so a real user opening
// the feature always lands on a cache hit — zero AI latency, zero chance of a
// model timeout on what's meant to be a frictionless daily surface.
//
// Like the general precache script, it drives the real /api/signal/analyze route
// (with the owner-bypass header) rather than touching the DB directly, so the
// cache key it writes matches EXACTLY the key the Word-of-the-Day endpoint reads.
// Idempotent: an already-cached word returns cacheHit=true and costs 0 AI calls,
// so re-running after editing the seed list only generates the new entries.
//
// Run (local dev server must be up):
//   node --env-file=.env.local scripts/precache/word-of-day.ts
// Against production:
//   PRECACHE_BASE_URL=https://empire-signal.vercel.app \
//     node --env-file=.env.local scripts/precache/word-of-day.ts

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { WORDS_EN, WORDS_ES } from '../../src/lib/word-of-day/seed.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

const BASE = process.env.PRECACHE_BASE_URL || 'http://localhost:3000';
const DELAY = 1500; // ms between requests, matching the general precache pacing

function loadOwnerKey(): string | null {
  if (process.env.OWNER_BYPASS_KEY) return process.env.OWNER_BYPASS_KEY;
  for (const f of ['.env.local', '.env']) {
    try {
      const m = readFileSync(join(ROOT, f), 'utf8').match(/^OWNER_BYPASS_KEY=(.+)$/m);
      if (m) return m[1].trim();
    } catch {
      /* file may not exist */
    }
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type AnalyzeResponse = { cacheHit?: boolean; error?: string };

async function analyze(word: string, language: 'en' | 'es', ownerKey: string) {
  const res = await fetch(`${BASE}/api/signal/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-owner-key': ownerKey },
    body: JSON.stringify({ word, language }),
  });
  let data: AnalyzeResponse | null = null;
  try {
    data = (await res.json()) as AnalyzeResponse;
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, data };
}

async function main() {
  const ownerKey = loadOwnerKey();
  if (!ownerKey) {
    console.error('OWNER_BYPASS_KEY not found (env or .env.local). Aborting.');
    process.exit(1);
  }

  const queue: Array<{ word: string; language: 'en' | 'es' }> = [
    ...WORDS_EN.map((word) => ({ word, language: 'en' as const })),
    ...WORDS_ES.map((word) => ({ word, language: 'es' as const })),
  ];

  console.log(
    `Word-of-the-Day pre-cache — ${queue.length} words (${WORDS_EN.length} EN + ${WORDS_ES.length} ES) against ${BASE}\n`,
  );

  let generated = 0; // new AI-costing analyses
  let cached = 0; // already in cache (free)
  const failures: string[] = [];

  for (const { word, language } of queue) {
    let r;
    try {
      r = await analyze(word, language, ownerKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ERR  ${language} ${word} — ${msg}`);
      failures.push(`${language} ${word} (${msg})`);
      await sleep(DELAY);
      continue;
    }

    if (r.status === 200 && r.data?.cacheHit === false) {
      generated++;
      console.log(`  NEW  ${language} ${word}`);
      await sleep(DELAY);
    } else if (r.status === 200 && r.data?.cacheHit === true) {
      cached++;
      console.log(`  HIT  ${language} ${word}`);
      // already cached — costs nothing, no need to pause
    } else {
      console.log(`  ${r.status}  ${language} ${word} — ${r.data?.error ?? 'unexpected'}`);
      failures.push(`${language} ${word} (status ${r.status}: ${r.data?.error ?? 'unexpected'})`);
      await sleep(DELAY);
    }
  }

  console.log(
    `\nDone — newly generated: ${generated}, already cached: ${cached}, failed: ${failures.length}.`,
  );
  if (failures.length) {
    console.log('\nFAILURES (re-run to retry these):');
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exit(1);
  }
  const total = queue.length;
  console.log(
    `All ${total} Word-of-the-Day words are cached. Verify with:\n` +
      `  SELECT count(*) FROM search_records WHERE lower(word) IN (${queue
        .map((q) => `'${q.word.toLowerCase()}'`)
        .join(', ')});`,
  );
}

main().catch((err) => {
  console.error('[word-of-day precache] FATAL', err);
  process.exit(1);
});
