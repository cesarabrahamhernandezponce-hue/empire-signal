const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
// Free OpenRouter models routinely take 30-60s to emit the full analysis JSON.
// A short timeout just forced a wasteful "abort at 30s → restart" waterfall that
// added latency without improving success. Give one pass enough room to finish.
const TIMEOUT_MS = 45000;
// Free models reject bursts with HTTP 429 + a Retry-After hint. Wait and retry
// the same model once (capped) instead of discarding it — recovers the per-minute
// rate limit without firing yet another model and burning more daily quota.
const RETRY_AFTER_CAP_MS = 6000;
// The full analysis JSON runs ~700-1000 completion tokens, and some models add
// reasoning tokens on top. 1200 truncated the output mid-string → unterminated
// JSON → parse failure on every cache-miss. Give enough headroom to finish.
const MAX_TOKENS = 4000;

function stripCodeFences(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]+)\s*```/);
  if (match) return match[1].trim();
  return text.trim();
}

// Models launched simultaneously; first response with VALID JSON wins.
// Only non-reasoning instruct models — reasoning models (e.g. nemotron-3-nano)
// spend most of the token budget "thinking" and return a truncated fragment
// that wins the race but fails to parse, breaking every cache-miss analysis.
//
// Kept deliberately small (3, not 5). On the free tier the binding constraint is
// the daily request cap, not model speed: every model fired counts against it, so
// a wide fan-out exhausts the quota ~2x faster and self-inflicts 429s under load.
// Three reliable models give enough redundancy while tripling daily capacity.
const MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'openai/gpt-oss-20b:free',
];

// Fallback pass only if all primary models fail — different models to dodge a
// provider-specific outage or rate-limit.
const RETRY_MODELS = [
  'google/gemma-4-31b-it:free',
  'openai/gpt-oss-120b:free',
];

export type AIResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

// Flatten an AggregateError (from Promise.any) into a short list of messages.
function describeAggregate(err: unknown): string {
  if (err instanceof AggregateError) {
    return err.errors.map((e) => (e instanceof Error ? e.message : String(e))).join(', ');
  }
  return err instanceof Error ? err.message : String(err);
}

function raceModels(
  models: string[],
  prompt: string,
  isJson: boolean,
): { promise: Promise<string>; cleanup: () => void } {
  const controllers = models.map(() => new AbortController());
  const timers: ReturnType<typeof setTimeout>[] = [];

  function cleanup() {
    timers.forEach(clearTimeout);
    controllers.forEach((c) => { try { c.abort(); } catch { /* already aborted */ } });
  }

  const attempts = models.map((model, i) => {
    const controller = controllers[i];
    const deadline = Date.now() + TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    timers.push(timer);

    const run = async (): Promise<string> => {
      // Re-try the SAME model at most once after a 429; any other outcome
      // resolves or rejects immediately. One retry recovers the transient
      // per-minute limit; looping further just burns the daily quota and makes
      // a hard rate-limit take the full timeout to surface as a failure.
      let retried429 = false;
      for (;;) {
        const res = await fetch(BASE_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
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
        if (!isJson) return raw;

        // Reject responses that aren't parseable JSON so a fast-but-truncated
        // or garbled answer can't win the race and poison the result —
        // Promise.any then falls through to a model that returns valid JSON.
        const cleaned = stripCodeFences(raw);
        JSON.parse(cleaned); // throws on invalid JSON → this attempt loses the race
        return cleaned;
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

  if (!process.env.OPENROUTER_API_KEY) {
    // Misconfiguration, not a transient outage — log loudly so it's obvious in
    // deploy logs instead of silently sending `Bearer undefined` to every model.
    console.error('[ai/client] OPENROUTER_API_KEY is not set — every AI request will fail.');
    return { ok: false, error: 'The AI service is not configured.' };
  }

  const first = raceModels(MODELS, prompt, isJson);
  try {
    const text = await first.promise;
    first.cleanup();
    return { ok: true, text };
  } catch (firstErr) {
    first.cleanup();

    const retry = raceModels(RETRY_MODELS, prompt, isJson);
    try {
      const text = await retry.promise;
      retry.cleanup();
      return { ok: true, text };
    } catch (retryErr) {
      retry.cleanup();
      // Both passes exhausted — surface why so failures aren't a black box.
      // Promise.any rejects with an AggregateError carrying every model's error.
      console.error('[ai/client] All models failed.', {
        first:  describeAggregate(firstErr),
        retry:  describeAggregate(retryErr),
      });
      return { ok: false, error: 'The AI service is temporarily busy. Please try again in a moment.' };
    }
  }
}
