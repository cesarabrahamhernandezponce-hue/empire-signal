export function buildAnalyzePromptES(
  word: string,
  context: string | null,
): string {
  const contextText = context?.trim() || 'Sin contexto específico proporcionado.';

  return `Analiza la palabra en español que aparece abajo y devuelve un análisis lingüístico como objeto JSON.

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
      "guide": "<guía de pronunciación en español simple, sin símbolos técnicos>"
    },
    "usageExamples": [
      { "register": "formal",    "example": "<oración>" },
      { "register": "technical", "example": "<oración>" },
      { "register": "everyday",  "example": "<oración>" }
    ],
    "collocations": [
      { "phrase": "<combinación natural>", "meaning": "<uso o significado>" },
      { "phrase": "<combinación natural>", "meaning": "<uso o significado>" },
      { "phrase": "<combinación natural>", "meaning": "<uso o significado>" },
      { "phrase": "<combinación natural>", "meaning": "<uso o significado>" },
      { "phrase": "<combinación natural>", "meaning": "<uso o significado>" }
    ],
    "mnemonic": "<Crea un truco de memoria vívido e inesperado para esta palabra. Usa UNA de estas técnicas — la que mejor encaje: (1) Asociación sonora: la palabra suena como otra palabra o frase que conecta con su significado; (2) Imagen visual: una imagen mental bizarra, imposible o graciosa que fija el significado (cuanto más extraña mejor); (3) Historia gancho: una micro-historia de 1 oración donde el significado de la palabra es el remate. Reglas: máximo 25 palabras, debe ser inmediatamente memorable, debe conectar directamente con el significado central, nunca uses asociaciones genéricas u obvias.>"
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
- collocations: exactamente 5 elementos.
- synonyms: exactamente 4 elementos.
- wordFamily: exactamente 4 elementos.
- antonyms: exactamente 3 elementos. Si la palabra no tiene antónimos reales, usa un array vacío [].
- commonErrors: 1 o 2 elementos.
- cefr: asigna el nivel CEFR (A1/A2/B1/B2/C1/C2) que mejor representa la dificultad de esta palabra para estudiantes de inglés. Devuelve solo el código del nivel, nada más.
- Todo el contenido en español. Las claves siempre en inglés.
- No inventes etimologías ni hechos falsos. Si no estás seguro, sé conservador.
- Si la palabra es ambigua, prioriza el significado en el contexto dado.`;
}
