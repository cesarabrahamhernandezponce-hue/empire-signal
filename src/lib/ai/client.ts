const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 25000;

function stripCodeFences(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]+)\s*```/);
  if (match) return match[1].trim();
  return text.trim();
}

// All models launched simultaneously; first successful response wins
const MODELS = [
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'openai/gpt-oss-120b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
];

// Single immediate retry if all 5 fail
const RETRY_MODELS = [
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
];

export type AIResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

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

  const attempts = models.map((model, i) =>
    new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        controllers[i].abort();
        reject(new Error('timeout'));
      }, TIMEOUT_MS);
      timers.push(timer);

      fetch(BASE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(isJson ? [{ role: 'system', content: 'You are a JSON API. Respond with a single valid JSON object. No markdown, no code fences, no explanation — raw JSON only.' }] : []),
            { role: 'user', content: prompt },
          ],
          ...(isJson ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controllers[i].signal,
      }).then(async (res) => {
        clearTimeout(timer);
        if (!res.ok) { reject(new Error(`HTTP ${res.status}`)); return; }
        const data = await res.json() as { choices?: { message?: { content?: string } }[] };
        const raw = data.choices?.[0]?.message?.content;
        if (!raw) { reject(new Error('empty')); return; }
        resolve(isJson ? stripCodeFences(raw) : raw);
      }).catch((e: unknown) => {
        clearTimeout(timer);
        reject(e);
      });
    }),
  );

  return { promise: Promise.any(attempts), cleanup };
}

export async function generateContent(
  prompt: string,
  mimeType: string = 'application/json',
): Promise<AIResult> {
  const isJson = mimeType === 'application/json';

  const first = raceModels(MODELS, prompt, isJson);
  try {
    const text = await first.promise;
    first.cleanup();
    return { ok: true, text };
  } catch {
    first.cleanup();
  }

  const retry = raceModels(RETRY_MODELS, prompt, isJson);
  try {
    const text = await retry.promise;
    retry.cleanup();
    return { ok: true, text };
  } catch {
    retry.cleanup();
    return { ok: false, error: 'The AI service is temporarily busy. Please try again in a moment.' };
  }
}
