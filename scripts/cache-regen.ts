#!/usr/bin/env node
// Regenerate cached SearchRecords that the quality sweep flags as defective
// (foreign-script fragments, encoding corruption, etc.). Reuses the exact same
// analyze prompt + AI client + schema parser the live route uses, then UPDATES
// analysisJson IN PLACE by id — the row's id and shareId are preserved, so no
// share link breaks and word-of-day's foreign-key to the record stays intact
// (deleting instead would violate the WordOfTheDay FK, which has no cascade).
//
// Each regenerated analysis is re-scanned before writing; if the free model
// reproduces an artifact, it retries up to MAX_ATTEMPTS and skips the record if
// it never comes back clean, rather than overwriting good-ish data with garbage.
//
// Dry run (default — shows what it WOULD do, writes nothing):
//   node --env-file=.env --env-file=.env.local scripts/cache-regen.ts
// Apply the fixes:
//   node --env-file=.env --env-file=.env.local scripts/cache-regen.ts --apply

import { Pool } from 'pg';
import { SUPABASE_ROOT_CA } from '../src/lib/db/supabase-ca.ts';
import { generateContent } from '../src/lib/ai/client.ts';
import { buildAnalyzePromptEN } from '../src/lib/ai/prompts/analyze-en.ts';
import { buildAnalyzePromptES } from '../src/lib/ai/prompts/analyze-es.ts';
import { parseAnalysis, type Analysis } from '../src/lib/ai/schemas/analysis.ts';
import { scan } from './cache-quality.ts';

const APPLY = process.argv.includes('--apply');
const MAX_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Regenerate one word's base analysis, mirroring the cache-miss path in
// analyzeWord (prompt with null context; canonical word restored from the model).
// Returns a clean Analysis or null if every attempt still tripped the sweep.
async function regenerate(word: string, language: string): Promise<Analysis | null> {
  const isEs = language.toUpperCase() === 'ES';
  const prompt = isEs ? buildAnalyzePromptES(word, null) : buildAnalyzePromptEN(word, null);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ai = await generateContent(prompt);
    if (!ai.ok) {
      console.log(`    attempt ${attempt}: AI error (${ai.error}) — retrying`);
      await sleep(1500);
      continue;
    }
    const parsed = parseAnalysis(ai.text);
    if (!parsed.ok) {
      console.log(`    attempt ${attempt}: unparseable output — retrying`);
      await sleep(1500);
      continue;
    }
    const canonical = parsed.data.word?.trim().toLowerCase() || word;
    const analysis: Analysis = { ...parsed.data, word: canonical };
    const findings = scan(analysis, language);
    if (findings.length === 0) {
      console.log(`    attempt ${attempt}: clean (${ai.provider}:${ai.model})`);
      return analysis;
    }
    console.log(`    attempt ${attempt}: still flagged [${findings.map((f) => f.check).join(', ')}] — retrying`);
    await sleep(1500);
  }
  return null;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Run with: node --env-file=.env --env-file=.env.local scripts/cache-regen.ts');
    process.exit(1);
  }
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true },
    max: 2,
    connectionTimeoutMillis: 10000,
  });

  const { rows } = await pool.query<{ id: string; word: string; language: string; analysisJson: unknown }>(
    'SELECT id, word, language, "analysisJson" FROM search_records ORDER BY word ASC',
  );
  const flagged = rows.filter((r) => scan(r.analysisJson, r.language).length > 0);

  console.log(
    `${rows.length} records scanned — ${flagged.length} flagged.` +
      (APPLY ? ' APPLYING fixes.\n' : ' DRY RUN (pass --apply to write).\n'),
  );

  let fixed = 0;
  let skipped = 0;
  for (const rec of flagged) {
    console.log(`• ${rec.language} "${rec.word}" (${rec.id})`);
    const clean = await regenerate(rec.word, rec.language);
    if (!clean) {
      console.log('    ✗ could not produce a clean analysis after retries — leaving as-is.');
      skipped++;
      continue;
    }
    if (!APPLY) {
      console.log('    → would UPDATE analysisJson in place.');
      fixed++;
      continue;
    }
    await pool.query('UPDATE search_records SET "analysisJson" = $1 WHERE id = $2', [JSON.stringify(clean), rec.id]);
    console.log('    ✓ updated in place (id/shareId preserved).');
    fixed++;
  }

  console.log(`\nDone — ${APPLY ? 'fixed' : 'would fix'}: ${fixed}, skipped: ${skipped}.`);
  await pool.end();
}

main().catch((err) => {
  console.error('[cache-regen] FATAL', err);
  process.exit(1);
});
