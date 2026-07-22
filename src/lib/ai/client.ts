// Free models can take a while to emit the full analysis JSON, so a pass needs
// real headroom — too short forces a wasteful "abort then restart" waterfall.
// But 45s let a single saturated provider hang the whole request; capped at 30s
// so an exhausted fallback chain surfaces its error sooner and the client retry
// can take over while the user is still waiting.
const TIMEOUT_MS = 30000;
// Free tiers reject bursts with HTTP 429 + a Retry-After hint. Wait and retry
// the same model once (capped) instead of discarding it — recovers the per-minute
// rate limit without firing another model and burning more daily quota.
const RETRY_AFTER_CAP_MS = 6000;
// Gemini's free tier returns intermittent 503 ("model overloaded") on flash-lite
// (~1 in 3 calls). A single quick retry recovers the fast primary instead of
// dropping the whole pass to the slower flash fallback, which also burns the
// smaller flash daily quota. Also covers transient 500/502.
const SERVER_ERROR_RETRY_MS = 800;
// The full analysis JSON runs ~700-1000 completion tokens, and some models add
// reasoning tokens on top. A low cap truncated the output mid-string →
// unterminated JSON → parse failure on every cache-miss. Give it headroom.
// Callers with small responses (validate/classify) can override via options.
const MAX_TOKENS = 4000;
// Total wall-clock budget across the WHOLE fallback chain. maxDuration on the
// routes is 60s; four passes at 30s each could otherwise stack to ~120s and the
// platform would kill the function mid-pass, so the user sees a generic timeout
// before the chain has honestly exhausted its providers. Cap the aggregate at
// 55s and shrink each pass's timeout to whatever budget remains.
const TOTAL_BUDGET_MS = 55000;
// Don't start a fresh pass with less than this left — a sub-3s window can't
// finish a free-model generation, so spending it just delays the error.
const MIN_PASS_MS = 3000;

import { stripJsonFences } from './json';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// OpenRouter free models. raceModels runs a pass's models concurrently and the
// first to return parseable JSON wins, so the first pass is a basket chosen to
// maximize P(fast valid win) while guaranteeing a reliable finisher. Slugs and
// order come from a live 3-sample JSON-mode benchmark (2026-07-22): the two
// nemotrons hit 3/3 valid JSON in ~4-9s; gemma-4-26b is fastest (~1s) but only
// ~1/3 available (free-tier 429s); gpt-oss-20b is a reliable-but-slow (~10-16s)
// backstop. Dropped google/gemma-4-31b-it:free — it 429'd 3/3 (dead weight).
// The JSON.parse guard means a truncated/reasoning fragment just loses the race.
const OPENROUTER_MODELS = [
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'google/gemma-4-26b-a4b-it:free',
  'openai/gpt-oss-20b:free',
];
const OPENROUTER_RETRY_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b:free',
  'openrouter/free',
];

type Pass = { provider: string; baseUrl: string; apiKey: string; models: string[] };

// Ordered fallback chain. All endpoints are OpenAI-compatible, so one fetch path
// serves every provider. Gemini first: its free tier (flash-lite ~1000/day,
// flash ~250/day) dwarfs OpenRouter's ~50/day and responds in ~5s vs ~30s.
// OpenRouter is the last-resort backup and is reachable from networks where
// Gemini/Groq are geo-blocked.
function buildPasses(): Pass[] {
  const gemini = process.env.GEMINI_API_KEY;
  const openrouter = process.env.OPENROUTER_API_KEY;
  const passes: Pass[] = [];
  if (gemini) {
    passes.push({ provider: 'gemini', baseUrl: GEMINI_URL, apiKey: gemini, models: ['gemini-2.5-flash-lite'] });
    passes.push({ provider: 'gemini', baseUrl: GEMINI_URL, apiKey: gemini, models: ['gemini-2.5-flash'] });
  }
  if (openrouter) {
    passes.push({ provider: 'openrouter', baseUrl: OPENROUTER_URL, apiKey: openrouter, models: OPENROUTER_MODELS });
    passes.push({ provider: 'openrouter', baseUrl: OPENROUTER_URL, apiKey: openrouter, models: OPENROUTER_RETRY_MODELS });
  }
  return passes;
}

export type AIResult =
  | { ok: true; text: string; model: string; provider: string }
  | { ok: false; error: string };

// Flatten an AggregateError (from Promise.any) into a short list of messages.
function describeAggregate(err: unknown): string {
  if (err instanceof AggregateError) {
    return err.errors.map((e) => (e instanceof Error ? e.message : String(e))).join(', ');
  }
  return err instanceof Error ? err.message : String(err);
}

type RaceWin = { text: string; model: string };

type RaceConfig = {
  isJson: boolean;
  temperature?: number;
  maxTokens: number;
  timeoutMs: number;
};

function raceModels(
  pass: Pass,
  prompt: string,
  cfg: RaceConfig,
): { promise: Promise<RaceWin>; cleanup: () => void } {
  const { isJson, temperature, maxTokens, timeoutMs } = cfg;
  const controllers = pass.models.map(() => new AbortController());
  const timers: ReturnType<typeof setTimeout>[] = [];

  function cleanup() {
    timers.forEach(clearTimeout);
    controllers.forEach((c) => { try { c.abort(); } catch { /* already aborted */ } });
  }

  const attempts = pass.models.map((model, i) => {
    const controller = controllers[i];
    const deadline = Date.now() + timeoutMs;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timers.push(timer);

    const run = async (): Promise<RaceWin> => {
      // Re-try the SAME model at most once each after a 429 or a transient 5xx;
      // any other outcome resolves or rejects immediately. One retry recovers
      // the transient per-minute limit / model-overload blip; looping further
      // just burns the daily quota and makes a hard failure take the full
      // timeout to surface.
      let retried429 = false;
      let retried5xx = false;
      for (;;) {
        const res = await fetch(pass.baseUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pass.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            ...(temperature !== undefined ? { temperature } : {}),
            messages: [
              ...(isJson ? [{ role: 'system', content: 'You are a JSON API. Respond with a single valid JSON object. No markdown, no code fences, no explanation — raw JSON only.' }] : []),
              { role: 'user', content: prompt },
            ],
            ...(isJson ? { response_format: { type: 'json_object' } } : {}),
          }),
          signal: controller.signal,
        });

        if (res.status === 429) {
          if (retried429) throw new Error('HTTP 429');
          retried429 = true;
          const retryAfter = Number(res.headers.get('retry-after'));
          const waitMs = Math.min((retryAfter > 0 ? retryAfter : 3) * 1000, RETRY_AFTER_CAP_MS);
          if (Date.now() + waitMs >= deadline) throw new Error('HTTP 429');
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        if (res.status === 503 || res.status === 500 || res.status === 502) {
          if (retried5xx) throw new Error(`HTTP ${res.status}`);
          retried5xx = true;
          if (Date.now() + SERVER_ERROR_RETRY_MS >= deadline) throw new Error(`HTTP ${res.status}`);
          await new Promise((r) => setTimeout(r, SERVER_ERROR_RETRY_MS));
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json() as { choices?: { message?: { content?: string } }[] };
        const raw = data.choices?.[0]?.message?.content;
        if (!raw) throw new Error('empty');
        if (!isJson) return { text: raw, model };

        // Reject responses that aren't parseable JSON so a fast-but-truncated
        // or garbled answer can't win the race and poison the result —
        // Promise.any then falls through to a model that returns valid JSON.
        const cleaned = stripJsonFences(raw);
        JSON.parse(cleaned); // throws on invalid JSON → this attempt loses the race
        return { text: cleaned, model };
      }
    };

    return run().finally(() => clearTimeout(timer));
  });

  return { promise: Promise.any(attempts), cleanup };
}

export type GenerateOptions = {
  // 'application/json' (default) validates the response is parseable JSON before
  // a model can win the race; 'text/plain' skips that (free-text answers, e.g. ask).
  mimeType?: string;
  // Set 0 for callers that promise determinism (validate/classify) — otherwise
  // the provider default (~1.0) makes repeat calls return different results.
  temperature?: number;
  // Override the completion-token cap for small responses.
  maxTokens?: number;
};

export async function generateContent(
  prompt: string,
  options: GenerateOptions = {},
): Promise<AIResult> {
  const { mimeType = 'application/json', temperature, maxTokens = MAX_TOKENS } = options;
  const isJson = mimeType === 'application/json';

  const passes = buildPasses();
  if (passes.length === 0) {
    // Misconfiguration, not a transient outage — log loudly so it's obvious in
    // deploy logs instead of silently failing every request.
    console.error('[ai/client] No AI provider key set (GEMINI_API_KEY / OPENROUTER_API_KEY).');
    return { ok: false, error: 'The AI service is not configured.' };
  }

  const startedAt = Date.now();
  const errors: string[] = [];
  for (const pass of passes) {
    // Global time budget: never start a pass that can't finish before the route's
    // maxDuration would kill the function mid-flight.
    const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
    if (remaining < MIN_PASS_MS) {
      errors.push(`${pass.provider}[${pass.models.join('/')}]: skipped (time budget exhausted)`);
      break;
    }
    const race = raceModels(pass, prompt, {
      isJson,
      temperature,
      maxTokens,
      timeoutMs: Math.min(TIMEOUT_MS, remaining),
    });
    try {
      const win = await race.promise;
      race.cleanup();
      // Surface which model actually answered so callers (and the smoke
      // harness) can attribute every successful generation to a model.
      console.log(`[ai/client] won by ${pass.provider}:${win.model}`);
      return { ok: true, text: win.text, model: win.model, provider: pass.provider };
    } catch (err) {
      race.cleanup();
      errors.push(`${pass.provider}[${pass.models.join('/')}]: ${describeAggregate(err)}`);
    }
  }

  // Every provider exhausted — surface why so failures aren't a black box.
  console.error('[ai/client] All providers failed.', errors);
  return { ok: false, error: 'The AI service is temporarily busy. Please try again in a moment.' };
}
