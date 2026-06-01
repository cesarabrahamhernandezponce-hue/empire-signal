const BASE_URL = 'https://openrouter.ai/api/v1/chat/completions';
const TIMEOUT_MS = 30000;

function stripCodeFences(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (match) return match[1].trim();
  return text.trim();
}

// Tried in order; next is used when a model is rate-limited (429) or times out
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
  const isJson = mimeType === 'application/json';

  for (const model of MODELS) {
    // Each model gets its own independent timeout so a slow/rate-limited model
    // doesn't eat into the budget of the next one.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(BASE_URL, {
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
        signal: controller.signal,
      });

      if (res.status === 429) continue;

      if (!res.ok) {
        return { ok: false, error: 'Could not reach the AI service.' };
      }

      const data = await res.json() as { choices?: { message?: { content?: string } }[] };
      const raw = data.choices?.[0]?.message?.content;

      if (!raw) {
        return { ok: false, error: 'The AI returned an empty response.' };
      }

      const text = isJson ? stripCodeFences(raw) : raw;
      return { ok: true, text };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        continue; // timeout — try next model
      }
      return { ok: false, error: 'Could not reach the AI service.' };
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, error: 'The AI service is temporarily busy. Please try again in a moment.' };
}
