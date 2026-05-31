const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 30000;

// Tried in order; next is used when a model is rate-limited (429)
const MODELS = [
  'openai/gpt-oss-120b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemma-4-31b-it:free',
];

export type AIResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function generateContent(
  prompt: string,
  mimeType: string = 'application/json',
): Promise<AIResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const isJson = mimeType === 'application/json';

  try {
    for (const model of MODELS) {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          ...(isJson ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controller.signal,
      });

      if (res.status === 429) continue; // try next model

      if (!res.ok) {
        return { ok: false, error: 'Could not reach the AI service.' };
      }

      const data = await res.json() as { choices?: { message?: { content?: string } }[] };
      const text = data.choices?.[0]?.message?.content;

      if (!text) {
        return { ok: false, error: 'The AI returned an empty response.' };
      }

      return { ok: true, text };
    }

    return { ok: false, error: 'The AI service is temporarily busy. Please try again in a moment.' };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'The request took too long. Please try again.' };
    }
    return { ok: false, error: 'Could not reach the AI service.' };
  } finally {
    clearTimeout(timer);
  }
}
