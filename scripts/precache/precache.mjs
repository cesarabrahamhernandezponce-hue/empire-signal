#!/usr/bin/env node
// Pre-cache common ES/EN words into Supabase by driving the real analyze
// endpoint. Going through the route (not the DB directly) reuses the exact
// normalization, dictionary check and global cache real users hit, so the
// cache keys match perfectly. The owner-bypass header skips the user-facing
// rate limit. Idempotent: a word already cached comes back as cacheHit=true
// and costs 0 AI requests, so re-running just resumes where the last run
// stopped — run it across several days to stay inside the free daily quota.
//
// Usage:
//   node scripts/precache/precache.mjs                 # both languages, default cap
//   node scripts/precache/precache.mjs --lang en       # one language
//   node scripts/precache/precache.mjs --limit 800     # raise the per-run AI cap
//   node scripts/precache/precache.mjs --delay 2000    # ms pause between requests

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BASE = process.env.PRECACHE_BASE_URL || arg('base', 'http://localhost:3000');
const LANG = arg('lang', 'both');                  // es | en | both
const LIMIT = Number(arg('limit', '400'));         // max NEW (AI-costing) words this run
const DELAY = Number(arg('delay', '1500'));        // ms between requests
const STOP_AFTER_FAILS = 4;                         // consecutive 503s → quota likely spent, stop

function loadOwnerKey() {
  if (process.env.OWNER_BYPASS_KEY) return process.env.OWNER_BYPASS_KEY;
  for (const f of ['.env.local', '.env']) {
    try {
      const m = readFileSync(join(ROOT, f), 'utf8').match(/^OWNER_BYPASS_KEY=(.+)$/m);
      if (m) return m[1].trim();
    } catch { /* file may not exist */ }
  }
  return null;
}

// Same normalization the route applies, so we never enqueue a word that would
// resolve to an already-cached key under a different surface form.
function normalize(raw) {
  return raw.toLowerCase().replace(/^[\s!?¡¿.,;:'"()\[\]{}]+|[\s!?¡¿.,;:'"()\[\]{}]+$/g, '');
}

function loadWords(lang) {
  const txt = readFileSync(join(HERE, `words-${lang}.txt`), 'utf8');
  const seen = new Set();
  const out = [];
  for (const line of txt.split('\n')) {
    const w = normalize(line.trim());
    if (!w || w.startsWith('#') || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function analyze(word, language, ownerKey) {
  const res = await fetch(`${BASE}/api/signal/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-owner-key': ownerKey },
    body: JSON.stringify({ word, language }),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }
  return { status: res.status, data };
}

async function main() {
  const ownerKey = loadOwnerKey();
  if (!ownerKey) {
    console.error('OWNER_BYPASS_KEY not found (env or .env.local). Aborting.');
    process.exit(1);
  }

  const langs = LANG === 'both' ? ['en', 'es'] : [LANG];
  // Interleave languages so a partial run still broadens coverage in both.
  const queue = [];
  const lists = Object.fromEntries(langs.map((l) => [l, loadWords(l)]));
  for (let i = 0; ; i++) {
    let added = false;
    for (const l of langs) {
      if (i < lists[l].length) { queue.push({ word: lists[l][i], language: l }); added = true; }
    }
    if (!added) break;
  }

  console.log(`Pre-cache start — ${queue.length} words queued (${langs.join(', ')}), AI cap ${LIMIT}/run, ${DELAY}ms spacing.\n`);

  let priced = 0;     // requests that cost an AI call (new + not-found)
  let cached = 0;     // already in cache (free)
  let notFound = 0;
  let failed = 0;
  let consecutive503 = 0;
  const t0 = Date.now();

  for (const { word, language } of queue) {
    if (priced >= LIMIT) {
      console.log(`\nReached per-run AI cap (${LIMIT}). Stopping — run again tomorrow to continue.`);
      break;
    }

    let r;
    try {
      r = await analyze(word, language, ownerKey);
    } catch (err) {
      console.log(`  ERR  ${language} ${word} — ${err.message}`);
      failed++; consecutive503++;
      if (consecutive503 >= STOP_AFTER_FAILS) { console.log('\nToo many failures in a row — provider quota likely exhausted. Stopping.'); break; }
      await sleep(DELAY);
      continue;
    }

    if (r.status === 200 && r.data?.cacheHit === false) {
      priced++; consecutive503 = 0;
      console.log(`  NEW  ${language} ${word}   [${priced}/${LIMIT}]`);
    } else if (r.status === 200 && r.data?.cacheHit === true) {
      cached++; consecutive503 = 0;
      // skip — costs nothing, no delay needed
      continue;
    } else if (r.status === 422) {
      priced++; notFound++; consecutive503 = 0;   // not-found still spent an AI call (spell-check / sentinel)
      console.log(`  NF   ${language} ${word} — not a valid word, skipping`);
    } else if (r.status === 503) {
      failed++; consecutive503++;
      console.log(`  503  ${language} ${word} — AI busy/quota (${consecutive503}/${STOP_AFTER_FAILS})`);
      if (consecutive503 >= STOP_AFTER_FAILS) { console.log('\nProvider quota likely exhausted for today. Stopping — resume tomorrow.'); break; }
    } else {
      failed++; consecutive503 = 0;
      console.log(`  ${r.status}  ${language} ${word} — ${r.data?.error ?? 'unexpected'}`);
    }

    await sleep(DELAY);
  }

  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\nDone in ${mins} min — new: ${priced - notFound}, not-found: ${notFound}, already cached: ${cached}, failed: ${failed}.`);
  console.log('Re-run anytime; cached words are skipped for free.');
}

main();
