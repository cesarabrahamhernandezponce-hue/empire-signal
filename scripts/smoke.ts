#!/usr/bin/env node
// Pre-launch smoke harness for Empire Signal.
//
// Hammers the real /api/signal/analyze flow with a representative battery and
// verifies STRUCTURAL correctness (not subjective quality): every input must
// return a valid analysis shape OR a clean, correctly-coded error — never a
// crash, never a 500, never a real word mislabelled as a typo. Also fires one
// validate and one ask call, and reports which model answered each call.
//
// Run (local):
//   node --env-file=.env.local scripts/smoke.ts
// Run against PRODUCTION (final pre-Reddit check):
//   BASE_URL=https://empire-signal.vercel.app node --env-file=.env.local scripts/smoke.ts
// (OWNER_BYPASS_KEY must match the target environment's key. The .env.local key
//  is the LOCAL key; for prod, export the prod key first.)

import { analysisSchema } from '../src/lib/ai/schemas/analysis.ts';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const OWNER_KEY = process.env.OWNER_BYPASS_KEY ?? '';
const REQ_TIMEOUT_MS = 70_000;

// ── Hypernym post-filter — MIRRORS src/lib/services/signal.ts ────────────────
// Kept in sync by hand (importing signal.ts would drag in Prisma + a live DB
// connection). If the source list changes, update this too.
const SYNONYM_HYPERNYMS = new Set([
  'fruta', 'animal', 'cosa', 'objeto', 'planta', 'comida', 'verdura',
  'ser', 'ente', 'elemento', 'sustancia', 'material',
  'fruit', 'animal', 'thing', 'object', 'plant', 'food', 'being',
  'entity', 'substance', 'material', 'item',
]);
const GENERIC_NUANCE_RE =
  /genérico|engloba|cualquier|categoría|tipo de|generic|any kind of|umbrella term|class of|category of/i;

type Lang = 'en' | 'es';
type Sugg = 'present' | 'null';
type Case = {
  input: string;
  lang: Lang;
  expect: 200 | 422 | 400;
  suggestion?: Sugg; // only meaningful for 422
  note?: string;
};

const CASES: Case[] = [
  // EN — must return 200 + valid schema
  { input: 'ephemeral',          lang: 'en', expect: 200, note: 'baseline' },
  { input: 'run',                lang: 'en', expect: 200, note: 'polysemous' },
  { input: 'give up',            lang: 'en', expect: 200, note: 'phrasal' },
  { input: 'look forward to',    lang: 'en', expect: 200, note: '3 words' },
  { input: 'kick the bucket',    lang: 'en', expect: 200, note: 'idiom' },
  { input: 'rizz',               lang: 'en', expect: 200, note: 'slang' },
  { input: 'NASA',               lang: 'en', expect: 200, note: 'acronym' },
  { input: 'ghosting',           lang: 'en', expect: 200, note: 'neologism' },
  { input: 'London',             lang: 'en', expect: 200, note: 'proper noun (vocab)' },
  { input: "don't",              lang: 'en', expect: 200, note: 'apostrophe kept' },
  { input: 'mother-in-law',      lang: 'en', expect: 200, note: 'hyphen, 1 word' },

  // EN — must return 422 (not a typo-mislabel for real words; gibberish → null)
  { input: 'recieve',            lang: 'en', expect: 422, suggestion: 'present', note: 'typo' },
  { input: 'definately',         lang: 'en', expect: 422, suggestion: 'present', note: 'typo' },
  { input: 'asdfgh',             lang: 'en', expect: 422, suggestion: 'null',    note: 'gibberish, no invented word' },

  // EN — must return 400 (pure input gate, before AI/DB)
  { input: '',                   lang: 'en', expect: 400, note: 'empty' },
  { input: '123',                lang: 'en', expect: 400, note: 'numeric only' },
  { input: '😀',                 lang: 'en', expect: 400, note: 'emoji' },
  { input: 'http://x.com',       lang: 'en', expect: 400, note: 'url' },
  { input: 'a b c d e f',        lang: 'en', expect: 400, note: 'too many words' },

  // ES — must return 200 + valid schema, response language = ES
  { input: 'canción',            lang: 'es', expect: 200, note: 'accent preserved' },
  { input: 'correr',             lang: 'es', expect: 200, note: 'common verb' },
  { input: 'chévere',            lang: 'es', expect: 200, note: 'regional, NOT blocked' },
  { input: 'guagua',             lang: 'es', expect: 200, note: 'regional' },
  { input: 'biblioteca',         lang: 'es', expect: 200, note: 'false friend' },
];

type Row = {
  input: string;
  lang: Lang;
  expected: number;
  got: number | string;
  pass: boolean;
  model: string;
  notes: string;
};

const rows: Row[] = [];
const fails: string[] = [];
const modelCounts = new Map<string, number>();
let firstEnRecordId: string | null = null;

function countModel(m: string) {
  modelCounts.set(m, (modelCounts.get(m) ?? 0) + 1);
}

type SmokeEssential = {
  meaningInContext?: unknown;
  usageExamples?: unknown[];
  collocations?: unknown[];
  wordTypes?: unknown[];
  wordType?: { category?: unknown };
};
type SmokeRecord = {
  id?: string;
  language?: string;
  analysis?: {
    essential?: SmokeEssential;
    advanced?: { synonyms?: Array<{ word?: unknown; nuance?: unknown }> };
  };
};
type SmokeJson = {
  record?: SmokeRecord;
  model?: string;
  cacheHit?: boolean;
  suggestion?: unknown;
  score?: unknown;
  feedback?: unknown;
  answer?: unknown;
} | null;

async function post(path: string, body: unknown): Promise<{ status: number; json: SmokeJson; ms: number; netError?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(OWNER_KEY ? { 'x-owner-key': OWNER_KEY } : {}),
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const ms = Date.now() - t0;
    let json: SmokeJson = null;
    try { json = await res.json(); } catch { /* non-JSON body */ }
    return { status: res.status, json, ms };
  } catch (err) {
    return { status: 0, json: null, ms: Date.now() - t0, netError: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

// Structural assertions for a 200 analyze response. Returns list of failure
// strings (empty = all good).
function check200(c: Case, json: SmokeJson): { problems: string[]; model: string } {
  const problems: string[] = [];
  const record = json?.record;
  const model = json?.model ?? (json?.cacheHit ? 'cache' : '(missing)');

  if (!record) {
    problems.push('no record in response');
    return { problems, model };
  }

  // 1. Zod schema
  const parsed = analysisSchema.safeParse(record.analysis);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    problems.push(`schema invalid: ${first.path.join('.')} — ${first.message}`);
  }

  const e: SmokeEssential = record.analysis?.essential ?? {};

  // 2. meaningInContext non-empty
  if (!e.meaningInContext || String(e.meaningInContext).trim().length === 0) {
    problems.push('meaningInContext empty');
  }
  // 3. usageExamples.length === 3
  if (!Array.isArray(e.usageExamples) || e.usageExamples.length !== 3) {
    problems.push(`usageExamples.length=${e.usageExamples?.length} (want 3)`);
  }
  // 4. collocations.length >= 3
  if (!Array.isArray(e.collocations) || e.collocations.length < 3) {
    problems.push(`collocations.length=${e.collocations?.length} (want >=3)`);
  }
  // 5. response language matches requested
  const want = c.lang.toUpperCase();
  if (record.language !== want) {
    problems.push(`language=${record.language} (want ${want})`);
  }
  // 6. no hypernyms in synonyms
  const syns = record.analysis?.advanced?.synonyms ?? [];
  for (const s of syns) {
    if (SYNONYM_HYPERNYMS.has(String(s.word).toLowerCase())) {
      problems.push(`hypernym synonym "${s.word}"`);
    }
    if (GENERIC_NUANCE_RE.test(String(s.nuance))) {
      problems.push(`generic-definition synonym "${s.word}"`);
    }
  }
  // 7. wordTypes present OR wordType fallback
  const hasWordTypes = Array.isArray(e.wordTypes) && e.wordTypes.length >= 1;
  const hasWordType = e.wordType && e.wordType.category;
  if (!hasWordTypes && !hasWordType) {
    problems.push('neither wordTypes nor wordType present');
  }

  // capture an EN record id for the ask test
  if (c.lang === 'en' && !firstEnRecordId && record.id) {
    firstEnRecordId = record.id;
  }

  return { problems, model };
}

async function runCase(c: Case) {
  const r = await post('/api/signal/analyze', { word: c.input, language: c.lang });
  const label = `${JSON.stringify(c.input)} [${c.lang}]`;

  if (r.netError) {
    rows.push({ input: c.input, lang: c.lang, expected: c.expect, got: `NET:${r.netError}`, pass: false, model: '-', notes: c.note ?? '' });
    fails.push(`${label}: network error — ${r.netError}`);
    return;
  }

  let pass = r.status === c.expect;
  let model = '-';
  const reasons: string[] = [];

  if (r.status !== c.expect) {
    reasons.push(`status ${r.status} (want ${c.expect}); body=${JSON.stringify(r.json)?.slice(0, 200)}`);
  }

  if (c.expect === 200 && r.status === 200) {
    const { problems, model: m } = check200(c, r.json);
    model = m;
    countModel(m);
    if (problems.length) { pass = false; reasons.push(...problems); }
  }

  if (c.expect === 422 && r.status === 422) {
    const sugg = r.json?.suggestion ?? null;
    if (c.suggestion === 'present' && !sugg) {
      pass = false; reasons.push('expected a suggestion, got null');
    }
    if (c.suggestion === 'null' && sugg) {
      pass = false; reasons.push(`expected null suggestion, got "${sugg}" (invented word!)`);
    }
  }

  rows.push({
    input: c.input, lang: c.lang, expected: c.expect,
    got: r.status, pass, model, notes: c.note ?? '',
  });
  if (!pass) fails.push(`${label}: ${reasons.join(' | ')}`);
}

async function runEndpointChecks() {
  // validate (EN)
  const vWord = 'run';
  const vSentence = 'I run every morning to stay fit.';
  const v = await post('/api/signal/validate', { sentence: vSentence, word: vWord, language: 'en' });
  const vPass = v.status === 200 && typeof v.json?.score === 'number' && typeof v.json?.feedback === 'string' && v.json.feedback.length > 0;
  rows.push({ input: `validate("${vWord}")`, lang: 'en', expected: 200, got: v.netError ? `NET:${v.netError}` : v.status, pass: vPass, model: '-', notes: 'endpoint' });
  if (!vPass) fails.push(`validate: status ${v.status}, body=${JSON.stringify(v.json)?.slice(0, 200)}`);

  // ask (EN) — needs a real searchRecordId from a prior 200
  if (firstEnRecordId) {
    const a = await post('/api/signal/ask', { searchRecordId: firstEnRecordId, question: 'Can you give one more example sentence?' });
    const aPass = a.status === 200 && typeof a.json?.answer === 'string' && a.json.answer.length > 0;
    rows.push({ input: `ask(rec)`, lang: 'en', expected: 200, got: a.netError ? `NET:${a.netError}` : a.status, pass: aPass, model: '-', notes: 'endpoint' });
    if (!aPass) fails.push(`ask: status ${a.status}, body=${JSON.stringify(a.json)?.slice(0, 200)}`);
  } else {
    rows.push({ input: `ask(rec)`, lang: 'en', expected: 200, got: 'SKIP', pass: false, model: '-', notes: 'no EN record id captured' });
    fails.push('ask: skipped — no EN 200 record id was captured');
  }
}

function pad(s: string, n: number) { return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); }

function printReport() {
  console.log('\n' + '='.repeat(120));
  console.log(`SMOKE TEST — ${BASE_URL}`);
  console.log('='.repeat(120));
  console.log(
    pad('INPUT', 20) + pad('LANG', 5) + pad('EXP', 5) + pad('GOT', 7) +
    pad('RESULT', 7) + pad('MODEL', 34) + 'NOTES',
  );
  console.log('-'.repeat(120));
  for (const r of rows) {
    console.log(
      pad(r.input, 20) + pad(r.lang, 5) + pad(String(r.expected), 5) + pad(String(r.got), 7) +
      pad(r.pass ? 'PASS' : 'FAIL', 7) + pad(r.model, 34) + r.notes,
    );
  }
  const passed = rows.filter((r) => r.pass).length;
  console.log('-'.repeat(120));
  console.log(`SUMMARY: ${passed}/${rows.length} passed`);

  if (fails.length) {
    console.log('\nFAILURES:');
    for (const f of fails) console.log(`  ✗ ${f}`);
  }

  console.log('\nMODEL WIN COUNTS (analyze 200s):');
  if (modelCounts.size === 0) {
    console.log('  (none — all cache hits or no successful analysis)');
  } else {
    for (const [m, n] of [...modelCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${pad(m, 40)} ${n}`);
    }
  }

  console.log('\n' + '='.repeat(120));
  console.log(fails.length === 0 ? 'SMOKE RESULT: ALL PASS' : `SMOKE RESULT: ${fails.length} FAILURE(S)`);
  console.log('='.repeat(120) + '\n');

  // Machine-readable tail for the runner.
  console.log(`__SMOKE_JSON__${JSON.stringify({ passed, total: rows.length, fails: fails.length })}`);
}

async function main() {
  if (!OWNER_KEY) {
    console.warn('[smoke] WARNING: OWNER_BYPASS_KEY not set — rate limits NOT bypassed. Run with --env-file=.env.local');
  }
  console.log(`[smoke] target=${BASE_URL}  cases=${CASES.length}`);
  for (const c of CASES) {
    process.stdout.write(`  → ${c.lang} ${JSON.stringify(c.input)} ... `);
    await runCase(c);
    const last = rows[rows.length - 1];
    console.log(`${last.got} ${last.pass ? 'PASS' : 'FAIL'}${last.model !== '-' ? ' [' + last.model + ']' : ''}`);
  }
  console.log('[smoke] endpoint checks (validate, ask) ...');
  await runEndpointChecks();
  printReport();
}

main().catch((err) => {
  console.error('[smoke] FATAL', err);
  process.exit(1);
});
