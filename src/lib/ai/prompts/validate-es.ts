export function buildValidatePromptES(sentence: string, word: string): string {
  return `Eres un evaluador de naturalidad lingüística. Un usuario escribió una oración usando la palabra en español "${word}".

Oración: "${sentence}"

Evalúa qué tan natural suena esta oración para un hablante nativo de español. Considera gramática, elección de palabras, idiomaticidad y fluidez.

Responde con SOLO un objeto JSON. Sin markdown, sin explicación, sin bloque de código:
{
  "natural": boolean,
  "score": número entre 0 y 100,
  "feedback": "máximo 2 oraciones de retroalimentación en texto plano",
  "suggestion": "versión mejorada de la oración solo si natural es false, si no null"
}`;
}
