export function buildValidatePromptES(sentence: string, word: string): string {
  return `Responde completamente en español. Todo el feedback y las sugerencias deben estar escritos en español sin importar el idioma de la oración proporcionada.

Evalúa esta oración que usa la palabra "${word}".

Oración: "${sentence}"

Puntúa la oración de 0-100 usando SOLO estos criterios fijos:
- Palabra usada con significado correcto en este contexto: +40 puntos
- Gramática correcta: +30 puntos
- Registro acorde al nivel de la palabra: +20 puntos
- La oración suena natural para un hablante nativo: +10 puntos
Resta puntos solo por errores claros y objetivos.
Aplica estos criterios mecánicamente — el score debe ser el mismo si se evalúa la misma oración dos veces.

Establece "natural" en true si el score >= 75, false en caso contrario.

Devuelve un objeto JSON con exactamente estos campos:
- "natural": true o false
- "score": entero de 0 a 100
- "feedback": 1-2 oraciones de retroalimentación en texto plano
- "suggestion": versión mejorada si natural es false, si no null`;
}
