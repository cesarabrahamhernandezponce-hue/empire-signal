import { z } from 'zod';
import { stripJsonFences } from '../json';

const translationSchema = z.record(z.string(), z.string());

export type Translation = z.infer<typeof translationSchema>;

export function parseTranslation(
  raw: string,
  expectedKeys: string[] = [],
): { ok: true; data: Translation } | { ok: false; error: string } {
  const cleaned = stripJsonFences(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: 'La respuesta de la IA no es JSON válido.' };
  }

  const result = translationSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      ok: false,
      error: `Respuesta de IA con estructura inválida: ${first.path.join('.') || 'body'} — ${first.message}`,
    };
  }

  // Verify all requested language keys are present and non-empty
  for (const key of expectedKeys) {
    if (!result.data[key]) {
      return { ok: false, error: `Missing or empty translation for language: ${key}` };
    }
  }

  return { ok: true, data: result.data };
}
