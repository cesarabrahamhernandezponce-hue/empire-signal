export function buildContextPromptES(word: string, context: string): string {
  return `El usuario está analizando la palabra '${word}' en este contexto específico: '${context}'.

Basándote en el análisis base ya realizado, explica en 2-3 oraciones cómo aplica esta palabra específicamente a la situación del usuario. Sé preciso y práctico. Céntrate solo en lo que cambia o se vuelve más relevante dado su contexto.

Devuelve SOLO un objeto JSON: { "contextNote": string }
Sin markdown, sin campos extra.`;
}
