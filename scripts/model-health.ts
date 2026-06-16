#!/usr/bin/env node
// Per-model health probe. Calls EACH model individually (NOT in a race) with a
// trivial JSON prompt and a 25s timeout, then reports status / latency / error.
//
// Two groups are probed:
//   [task]  the 5 models named in the launch checklist (all OpenRouter)
//   [live]  the models src/lib/ai/client.ts ACTUALLY races right now
// These two sets DO NOT MATCH — see the report note. The [live] set is what
// real traffic hits, so its health is what actually gates launch.
//
// Run:
//   node --env-file=.env.local scripts/model-health.ts

const TIMEOUT_MS = 25_000;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const PROMPT = 'Reply with exactly this raw JSON and nothing else: {"ok": true}';

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? '';
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? '';

type Provider = 'openrouter' | 'gemini';
type Probe = { provider: Provider; model: string; sets: string[] };

// Deduped union of the task list and the live-config list, tagged by membership.
const PROBES: Probe[] = [
  // task-listed (OpenRouter)
  { provider: 'openrouter', model: 'nvidia/nemotron-3-nano-30b-a3b:free',     sets: ['task'] },
  { provider: 'openrouter', model: 'openai/gpt-oss-120b:free',                sets: ['task', 'live'] },
  { provider: 'openrouter', model: 'nvidia/nemotron-3-super-120b-a12b:free',  sets: ['task'] },
  { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free',  sets: ['task', 'live'] },
  { provider: 'openrouter', model: 'nousresearch/hermes-3-llama-3.1-405b:free', sets: ['task'] },
  // live-config only (what the app actually races today)
  { provider: 'gemini',     model: 'gemini-2.5-flash-lite',                   sets: ['live'] },
  { provider: 'gemini',     model: 'gemini-2.5-flash',                        sets: ['live'] },
  { provider: 'openrouter', model: 'qwen/qwen3-next-80b-a3b-instruct:free',   sets: ['live'] },
  { provider: 'openrouter', model: 'openai/gpt-oss-20b:free',                 sets: ['live'] },
  { provider: 'openrouter', model: 'google/gemma-4-31b-it:free',              sets: ['live'] },
];

type Result = { model: string; provider: Provider; sets: string[]; status: 'ok' | 'timeout' | 'error'; ms: number; error: string };

async function probe(p: Probe): Promise<Result> {
  const url = p.provider === 'gemini' ? GEMINI_URL : OPENROUTER_URL;
  const key = p.provider === 'gemini' ? GEMINI_KEY : OPENROUTER_KEY;
  const base = { model: p.model, provider: p.provider, sets: p.sets };

  if (!key) {
    return { ...base, status: 'error', ms: 0, error: `no ${p.provider} key set` };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: p.model,
        max_tokens: 100,
        messages: [
          { role: 'system', content: 'You are a JSON API. Respond with raw JSON only.' },
          { role: 'user', content: PROMPT },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: ctrl.signal,
    });
    const ms = Date.now() - t0;
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.text()).slice(0, 160).replace(/\s+/g, ' '); } catch { /* ignore */ }
      return { ...base, status: 'error', ms, error: `HTTP ${res.status} ${detail}` };
    }
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { ...base, status: 'error', ms, error: 'empty response (no content)' };
    return { ...base, status: 'ok', ms, error: '' };
  } catch (err) {
    const ms = Date.now() - t0;
    if (err instanceof Error && err.name === 'AbortError') {
      return { ...base, status: 'timeout', ms, error: `timeout after ${TIMEOUT_MS}ms` };
    }
    return { ...base, status: 'error', ms, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

function pad(s: string, n: number) { return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length); }

async function main() {
  console.log(`[model-health] probing ${PROBES.length} models individually, ${TIMEOUT_MS}ms timeout each\n`);
  const results: Result[] = [];
  for (const p of PROBES) {
    process.stdout.write(`  → ${pad(`${p.provider}:${p.model}`, 52)} `);
    const r = await probe(p);
    results.push(r);
    console.log(`${r.status.toUpperCase()} (${r.ms}ms)${r.error ? ' — ' + r.error : ''}`);
  }

  console.log('\n' + '='.repeat(110));
  console.log('MODEL HEALTH');
  console.log('='.repeat(110));
  console.log(pad('MODEL', 52) + pad('SET', 12) + pad('STATUS', 9) + pad('LATENCY', 10) + 'ERROR');
  console.log('-'.repeat(110));
  for (const r of results) {
    console.log(
      pad(`${r.provider}:${r.model}`, 52) +
      pad(r.sets.join('+'), 12) +
      pad(r.status, 9) +
      pad(`${r.ms}ms`, 10) +
      (r.error || ''),
    );
  }
  console.log('-'.repeat(110));

  const liveOk = results.filter((r) => r.sets.includes('live') && r.status === 'ok');
  const liveTotal = results.filter((r) => r.sets.includes('live'));
  console.log(`LIVE-CONFIG MODELS HEALTHY: ${liveOk.length}/${liveTotal.length}  (these are what real traffic uses)`);
  const okAny = results.some((r) => r.status === 'ok');
  console.log(okAny ? 'At least one model answered — generation path is viable.' : 'NO model answered — generation path is DOWN.');
  console.log('='.repeat(110) + '\n');

  console.log(`__HEALTH_JSON__${JSON.stringify({ liveOk: liveOk.length, liveTotal: liveTotal.length, anyOk: okAny })}`);
}

main().catch((err) => {
  console.error('[model-health] FATAL', err);
  process.exit(1);
});
