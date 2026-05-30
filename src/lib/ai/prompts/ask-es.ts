export function buildAskPromptES(
  word: string,
  context: string | null,
  question: string,
): string {
  const contextText = context?.trim() || 'Sin contexto específico.';

  return `El usuario analizó previamente esta palabra: [${word}]
Contexto original: [${contextText}]

Ahora tiene una pregunta de seguimiento: ${question}

Eres un asistente de seguimiento para el análisis de la palabra '${word}' en el contexto '${contextText}'. Responde ÚNICAMENTE preguntas relacionadas con esta palabra y su contexto. Si la pregunta no está relacionada, responde educadamente que solo puedes hablar sobre esa palabra. Respuesta concisa, máximo 4 líneas.`;
}
