// Free models can take a while to emit the full analysis JSON. A short timeout
// just forced a wasteful "abort then restart" waterfall that added latency
// without improving success. Give one pass enough room to finish.
const TIMEOUT_MS = 45000;
// Free tiers reject bursts with HTTP 429 + a Retry-After hint. Wait and retry
// the same model once (capped) instead of discarding it — recovers the per-minute
// rate limit without firing another model and burning more daily quota.
const RETRY_AFTER_CAP_MS = 6000;
// The full analysis JSON runs ~700-1000 completion tokens, and some models add
// reasoning tokens on top. A low cap truncated the output mid-string →
// unterminated JSON → parse failure on every cache-miss. Give it headroom.
const MAX_TOKENS = 4000;

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// OpenRouter free models — only non-reasoning instruct models. Reasoning models
// (e.g. nemotron-3-nano) spend most of the token budget "thinking" and return a
// truncated fragment that wins the race but fails to parse.
const OPENROUTER_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'openai/gpt-oss-20b:free',
];
const OPENROUTER_RETRY_MODELS = [
  'google/gemma-4-31b-it:free',
  'openai/gpt-oss-120b:free',
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

function stripCodeFences(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]+)\s*```/);
  if (match) return match[1].trim();
  return text.trim();
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

function raceModels(
  pass: Pass,
  prompt: string,
  isJson: boolean,
): { promise: Promise<RaceWin>; cleanup: () => void } {
  const controllers = pass.models.map(() => new AbortController());
  const timers: ReturnType<typeof setTimeout>[] = [];

  function cleanup() {
    timers.forEach(clearTimeout);
    controllers.forEach((c) => { try { c.abort(); } catch { /* already aborted */ } });
  }

  const attempts = pass.models.map((model, i) => {
    const controller = controllers[i];
    const deadline = Date.now() + TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    timers.push(timer);

    const run = async (): Promise<RaceWin> => {
      // Re-try the SAME model at most once after a 429; any other outcome
      // resolves or rejects immediately. One retry recovers the transient
      // per-minute limit; looping further just burns the daily quota and makes
      // a hard rate-limit take the full timeout to surface as a failure.
      let retried429 = false;
      for (;;) {
        const res = await fetch(pass.baseUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${pass.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            max_tokens: MAX_TOKENS,
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
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json() as { choices?: { message?: { content?: string } }[] };
        const raw = data.choices?.[0]?.message?.content;
        if (!raw) throw new Error('empty');
        if (!isJson) return { text: raw, model };

        // Reject responses that aren't parseable JSON so a fast-but-truncated
        // or garbled answer can't win the race and poison the result —
        // Promise.any then falls through to a model that returns valid JSON.
        const cleaned = stripCodeFences(raw);
        JSON.parse(cleaned); // throws on invalid JSON → this attempt loses the race
        return { text: cleaned, model };
      }
    };

    return run().finally(() => clearTimeout(timer));
  });

  return { promise: Promise.any(attempts), cleanup };
}

export async function generateContent(
  prompt: string,
  mimeType: string = 'application/json',
): Promise<AIResult> {
  const isJson = mimeType === 'application/json';

  const passes = buildPasses();
  if (passes.length === 0) {
    // Misconfiguration, not a transient outage — log loudly so it's obvious in
    // deploy logs instead of silently failing every request.
    console.error('[ai/client] No AI provider key set (GEMINI_API_KEY / OPENROUTER_API_KEY).');
    return { ok: false, error: 'The AI service is not configured.' };
  }

  const errors: string[] = [];
  for (const pass of passes) {
    const race = raceModels(pass, prompt, isJson);
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
