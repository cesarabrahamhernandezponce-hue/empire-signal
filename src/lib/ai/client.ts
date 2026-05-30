import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = 'gemini-2.5-flash';
const TIMEOUT_MS = 30000;

export type AIResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function generateContent(
  prompt: string,
  mimeType: string = 'application/json',
): Promise<AIResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: mimeType,
        abortSignal: controller.signal,
      },
    });

    const text = response.text;

    if (!text) {
      return { ok: false, error: 'The AI returned an empty response.' };
    }

    return { ok: true, text };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'The request took too long. Please try again.' };
    }
    return { ok: false, error: 'Could not reach the AI service.' };
  } finally {
    clearTimeout(timer);
  }
}
