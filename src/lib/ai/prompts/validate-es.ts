export function buildValidatePromptES(sentence: string, word: string): string {
  return `Evalúa qué tan natural suena esta oración para un hablante nativo de español. La oración usa la palabra "${word}".

Oración: "${sentence}"

Considera: gramática, elección de palabras, idiomaticidad y fluidez.

Devuelve un objeto JSON con exactamente estos campos:
- "natural": true o false
- "score": entero de 0 a 100
- "feedback": 1-2 oraciones de retroalimentación en texto plano
- "suggestion": versión mejorada si natural es false, si no null`;
}
