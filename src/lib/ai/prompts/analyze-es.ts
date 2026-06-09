export function buildAnalyzePromptES(
  word: string,
  context: string | null,
): string {
  const contextText = context?.trim() || 'Sin contexto específico proporcionado.';

  return `Analiza la palabra en español que aparece abajo y devuelve un análisis lingüístico como objeto JSON.

IMPORTANTE: Si la palabra no existe en español estándar y no es un nombre propio reconocido, devuelve EXACTAMENTE este JSON y nada más:
{ "error": "WORD_NOT_FOUND", "suggestion": null }

Palabra: "${word}"
Contexto: ${contextText}

Estructura JSON requerida (rellena cada campo con contenido real — sin texto de ejemplo):

{
  "version": 1,
  "essential": {
    "cefr": "<código de nivel CEFR — uno de: A1, A2, B1, B2, C1, C2>",
    "meaningInContext": "<significado preciso en el contexto>",
    "wordType": {
      "category": "<uno de: sustantivo|verbo|adjetivo|adverbio|preposición|conjunción|interjección|pronombre>",
      "explanation": "<función gramatical en este contexto>"
    },
    "pronunciation": {
      "phonetic": "<transcripción IPA>",
      "guide": "<guía en prosa de máximo 2 oraciones: indica en qué sílaba recae el acento, describe los sonidos difíciles usando palabras de referencia conocidas, menciona cualquier sonido que resulte complicado para no nativos. Nunca reproduzcas el IPA. Nunca uses mayúsculas para marcar el acento — descríbelo con palabras.>"
    },
    "usageExamples": [
      { "register": "formal",    "example": "<oración>" },
      { "register": "technical", "example": "<oración>" },
      { "register": "everyday",  "example": "<oración>" }
    ],
    "collocations": [
      { "phrase": "<frase natural donde la palabra aparece en contexto real, p.ej. 'correr un maratón'>", "meaning": "<uso o significado>" },
      { "phrase": "<frase natural donde la palabra aparece en contexto real, p.ej. 'quedarse sin tiempo'>", "meaning": "<uso o significado>" },
      { "phrase": "<frase natural donde la palabra aparece en contexto real, p.ej. 'dirigir un negocio'>", "meaning": "<uso o significado>" },
      { "phrase": "<frase natural donde la palabra aparece en contexto real>", "meaning": "<uso o significado>" },
      { "phrase": "<frase natural donde la palabra aparece en contexto real>", "meaning": "<uso o significado>" }
    ],
    "meanings": [
      { "definition": "<significado más común>", "partOfSpeech": "<sustantivo|verbo|adjetivo|etc>", "example": "<oración corta opcional>" }
    ]
  },
  "advanced": {
    "etymology": "<origen y evolución histórica>",
    "story": "<narrativa cultural breve sobre la palabra>",
    "synonyms": [
      { "word": "<sinónimo>", "nuance": "<explica qué significa esta palabra y cuándo usarla, en UNA oración — céntrate en la palabra en sí, NO la compares con la palabra buscada, NO hagas ninguna referencia a la palabra original>" },
      { "word": "<sinónimo>", "nuance": "<explica qué significa esta palabra y cuándo usarla, en UNA oración — céntrate en la palabra en sí, NO la compares con la palabra buscada, NO hagas ninguna referencia a la palabra original>" },
      { "word": "<sinónimo>", "nuance": "<explica qué significa esta palabra y cuándo usarla, en UNA oración — céntrate en la palabra en sí, NO la compares con la palabra buscada, NO hagas ninguna referencia a la palabra original>" },
      { "word": "<sinónimo>", "nuance": "<explica qué significa esta palabra y cuándo usarla, en UNA oración — céntrate en la palabra en sí, NO la compares con la palabra buscada, NO hagas ninguna referencia a la palabra original>" }
    ],
    "antonyms": [
      { "word": "<antónimo>", "context": "<en qué contexto es antónimo>" },
      { "word": "<antónimo>", "context": "<en qué contexto es antónimo>" },
      { "word": "<antónimo>", "context": "<en qué contexto es antónimo>" }
    ],
    "registerLevel": {
      "level": "<uno de: formal|technical|colloquial|vulgar>",
      "guidance": "<en qué situaciones es apropiado usar esta palabra>"
    },
    "commonErrors": [
      { "error": "<error típico>", "correction": "<forma correcta y por qué>" }
    ],
    "wordFamily": [
      { "word": "<derivado>", "relation": "<relación morfológica con la palabra principal>" },
      { "word": "<derivado>", "relation": "<relación morfológica con la palabra principal>" },
      { "word": "<derivado>", "relation": "<relación morfológica con la palabra principal>" },
      { "word": "<derivado>", "relation": "<relación morfológica con la palabra principal>" }
    ]
  }
}

Reglas:
- collocations: exactamente 5 elementos. Cada frase debe ser una expresión natural donde la palabra aparece en contexto real (p.ej. "correr un maratón", "correr un riesgo", "correr a casa"). Nunca generes colocaciones que sean simplemente un sustantivo compuesto con la palabra analizada (p.ej. NO "maratón correr"). La palabra debe aparecer tal como se usa de forma natural en el habla o escritura fluida.
- synonyms: exactamente 4 elementos.
- wordFamily: exactamente 4 elementos.
- antonyms: exactamente 3 elementos. Si la palabra no tiene antónimos reales, usa un array vacío [].
- commonErrors: 1 o 2 elementos.
- cefr: asigna el nivel CEFR (A1/A2/B1/B2/C1/C2) que mejor representa la dificultad de esta palabra para estudiantes de español. Devuelve solo el código del nivel, nada más.
- meanings: si la palabra es polisémica (tiene varios significados distintos según la parte del discurso o el contexto — ej. "banco", "tipo", "pico", "cura"), rellena "meanings" con TODOS los significados relevantes ordenados por frecuencia de uso. Cada entrada: definition, partOfSpeech y opcionalmente un ejemplo corto. Si la palabra tiene un único significado claro ("efímero", "océano", "mesa"), devuelve un array con un solo elemento.
- Todo el contenido en español. Las claves siempre en inglés.
- No inventes etimologías ni hechos falsos. Si no estás seguro, sé conservador.
- Si la palabra es ambigua, prioriza el significado en el contexto dado.`;
}
