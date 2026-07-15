#!/usr/bin/env node
// Read-only quality sweep over every cached SearchRecord. Walks all text in each
// analysisJson and flags model-hallucination artifacts that slip past the JSON
// schema: foreign-script characters, encoding corruption, refusal/meta leakage,
// stray markdown/JSON, and structurally empty required fields. Reports only —
// it NEVER writes or deletes. Regenerating a bad record is a separate, deliberate
// step (it costs an AI call), so this just tells you which words to re-run.
//
// Run (reads DATABASE_URL from .env.local):
//   node --env-file=.env.local scripts/cache-quality.ts
//   node --env-file=.env.local scripts/cache-quality.ts --limit 50   # cap output

import { pathToFileURL } from 'node:url';
import { Pool } from 'pg';
import { SUPABASE_ROOT_CA } from '../src/lib/db/supabase-ca.ts';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const MAX_REPORT = Number(arg('limit', '200'));

type Finding = { check: string; path: string; snippet: string };

// Non-Latin scripts that are always hallucination artifacts in EN/ES prose:
// Cyrillic, CJK ideographs, Japanese kana, Hangul, Arabic, Hebrew, Devanagari.
// Greek is deliberately EXCLUDED — it appears legitimately in etymology fields
// (e.g. ἐφήμερος). IPA glyphs are excluded by dropping the phonetic field.
const FOREIGN_SCRIPT =
  /[Ѐ-ԯ一-鿿぀-ヿ가-힯؀-ۿ֐-׿ऀ-ॿ]/;
// Slavic consonant clusters (rz/cz/sz) and Polish diacritics. Applied ONLY to
// English records: in Spanish these clusters are everywhere (fuerza, esfuerzo),
// but in English they're rare, so a hit signals a foreign fragment like the
// "przestr" bug. A few legit English words trip it (czar, eczema) — treat as
// lower-confidence "review", not a definite defect.
const FOREIGN_LATIN_EN = /\b\w*(?:rz|cz|sz|[łźżćńęąś])\w*\b/i;
const REPLACEMENT = /�/;                 // encoding corruption
// Refusal/meta leakage. Tight on purpose: bare "I can't" / "I'm sorry" are valid
// example sentences, so only phrases that unambiguously reference the model leak.
const META_LEAK =
  /\b(as an ai\b|as a large language model|i am an ai|i'?m an ai|language model|i cannot (?:fulfill|provide|assist)|cannot assist with that)\b/i;
const CODE_FENCE = /```|^\s*\{\s*"(?:version|essential|advanced)"\s*:/m;

function walk(node: unknown, path: string, out: Array<{ path: string; value: string }>): void {
  if (typeof node === 'string') {
    out.push({ path, value: node });
  } else if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, `${path}[${i}]`, out));
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k, out);
  }
}

function collectStrings(analysis: unknown): Array<{ path: string; value: string }> {
  const all: Array<{ path: string; value: string }> = [];
  walk(analysis, '', all);
  // Drop the IPA phonetic field — its exotic glyphs are legitimate, not artifacts.
  return all.filter((s) => !s.path.endsWith('pronunciation.phonetic'));
}

// Show ±35 chars around the first regex match so the offending token is visible
// instead of getting cut off by a fixed head-of-string slice.
function context(value: string, re: RegExp): string {
  const m = value.match(re);
  const clean = value.replace(/\s+/g, ' ');
  if (!m || m.index === undefined) return clean.slice(0, 90);
  const flat = value.slice(0, m.index).replace(/\s+/g, ' ');
  const start = Math.max(0, flat.length - 35);
  return (start > 0 ? '…' : '') + clean.slice(start, flat.length + m[0].length + 35) + '…';
}

export function scan(analysis: unknown, language: string): Finding[] {
  const findings: Finding[] = [];
  const isEn = language.toUpperCase() === 'EN';
  const strings = collectStrings(analysis);
  for (const { path, value } of strings) {
    const add = (check: string, re: RegExp) =>
      findings.push({ check, path, snippet: context(value, re) });
    if (FOREIGN_SCRIPT.test(value)) add('foreign-script', FOREIGN_SCRIPT);
    else if (isEn && FOREIGN_LATIN_EN.test(value)) add('foreign-latin', FOREIGN_LATIN_EN);
    if (REPLACEMENT.test(value)) add('encoding-corruption', REPLACEMENT);
    if (META_LEAK.test(value)) add('meta-leak', META_LEAK);
    if (CODE_FENCE.test(value)) add('stray-markup', CODE_FENCE);
  }
  // Structural completeness: the essential block must carry a non-empty meaning.
  const a = analysis as { essential?: { meaningInContext?: string } };
  const meaning = a?.essential?.meaningInContext;
  if (!meaning || meaning.trim().length === 0) {
    findings.push({ check: 'empty-meaning', path: 'essential.meaningInContext', snippet: String(meaning ?? '') });
  }
  return findings;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Run with: node --env-file=.env.local scripts/cache-quality.ts');
    process.exit(1);
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true },
    max: 2,
    connectionTimeoutMillis: 10000,
  });

  const { rows } = await pool.query<{
    id: string;
    word: string;
    language: string;
    analysisJson: unknown;
  }>('SELECT id, word, language, "analysisJson" FROM search_records ORDER BY word ASC');

  console.log(`Scanned ${rows.length} cached records.\n`);

  const byCheck: Record<string, number> = {};
  const flagged: Array<{ word: string; language: string; id: string; findings: Finding[] }> = [];

  for (const r of rows) {
    const findings = scan(r.analysisJson, r.language);
    if (findings.length) {
      flagged.push({ word: r.word, language: r.language, id: r.id, findings });
      for (const f of findings) byCheck[f.check] = (byCheck[f.check] ?? 0) + 1;
    }
  }

  if (!flagged.length) {
    console.log('No quality issues found. Cache is clean.');
    await pool.end();
    return;
  }

  console.log(`Flagged ${flagged.length} record(s). Findings by type:`);
  for (const [check, n] of Object.entries(byCheck).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${check.padEnd(22)} ${n}`);
  }
  console.log('');

  for (const rec of flagged.slice(0, MAX_REPORT)) {
    console.log(`✗ ${rec.language} "${rec.word}"  (${rec.id})`);
    for (const f of rec.findings) {
      console.log(`    [${f.check}] ${f.path}: "${f.snippet}"`);
    }
  }
  if (flagged.length > MAX_REPORT) {
    console.log(`\n… ${flagged.length - MAX_REPORT} more (raise --limit to see all).`);
  }

  await pool.end();
}

// Only run the sweep when executed directly — importing this module (e.g. from
// cache-regen.ts, which reuses scan()) must not trigger a full DB scan.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('[cache-quality] FATAL', err);
    process.exit(1);
  });
}
