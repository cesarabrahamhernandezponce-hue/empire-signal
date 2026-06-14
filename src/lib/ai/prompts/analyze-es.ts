export function buildAnalyzePromptES(
  word: string,
  context: string | null,
): string {
  const contextText = context?.trim() || 'Sin contexto específico proporcionado.';

  return `Analiza la palabra en español que aparece abajo y devuelve un análisis lingüístico como objeto JSON.

IMPORTANTE: TODO el contenido del análisis debe estar redactado íntegramente en español. Ninguna frase ni palabra en inglés, salvo que la palabra analizada sea inglesa.

IMPORTANTE — FORMA CANÓNICA: Antes de analizar, normaliza la palabra de entrada a su forma canónica correcta en español, restaurando las tildes y la ñ que falten o estén mal escritas (p.ej. "anonimo" → "anónimo", "corazon" → "corazón", "nino" → "niño", "pequena" → "pequeña", "rapido" → "rápido"). Analiza SIEMPRE esa forma corregida, nunca la entrada literal mal escrita: el campo "word" y todo el contenido (significado, ejemplos, etc.) deben referirse a la forma canónica. Devuelve esa forma canónica en minúsculas, con sus tildes/ñ, en el campo "word".

IMPORTANTE: Si la palabra no existe en español estándar y no es un nombre propio reconocido, devuelve EXACTAMENTE este JSON y nada más:
{ "error": "WORD_NOT_FOUND", "suggestion": null }

Palabra: "${word}"
Contexto: ${contextText}

Estructura JSON requerida (rellena cada campo con contenido real — sin texto de ejemplo):

{
  "version": 1,
  "word": "<forma canónica correcta de la palabra, en minúsculas y con tildes/ñ restauradas>",
  "essential": {
    "cefr": "<código de nivel CEFR — uno de: A1, A2, B1, B2, C1, C2>",
    "meaningInContext": "<significado preciso en el contexto>",
    "wordType": {
      "category": "<uno de: sustantivo|verbo|adjetivo|adverbio|preposición|conjunción|interjección|pronombre>",
      "explanation": "<función gramatical en este contexto>"
    },
    "pronunciation": {
      "phonetic": "<SOLO la transcripción IPA compacta entre barras, p.ej. /eˈlo/ — máximo 30 caracteres, NUNCA una oración o explicación. Deja cadena vacía si no estás seguro.>",
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
      { "word": "<antónimo — SOLO si está atestiguado en diccionarios estándar>", "context": "<en qué contexto es antónimo>" },
      { "word": "<antónimo — SOLO si está atestiguado en diccionarios estándar>", "context": "<en qué contexto es antónimo>" },
      { "word": "<antónimo — SOLO si está atestiguado en diccionarios estándar>", "context": "<en qué contexto es antónimo>" }
    ],
    "registerLevel": {
      "level": "<uno de: formal|technical|colloquial|vulgar>",
      "guidance": "<en qué situaciones es apropiado usar esta palabra>"
    },
    "commonErrors": [
      { "error": "<error típico>", "correction": "<forma correcta y por qué>" }
    ],
    "wordFamily": [
      { "word": "<derivado — SOLO si está atestiguado en diccionarios estándar>", "relation": "<relación morfológica con la palabra principal>" },
      { "word": "<derivado — SOLO si está atestiguado en diccionarios estándar>", "relation": "<relación morfológica con la palabra principal>" },
      { "word": "<derivado — SOLO si está atestiguado en diccionarios estándar>", "relation": "<relación morfológica con la palabra principal>" },
      { "word": "<derivado — SOLO si está atestiguado en diccionarios estándar>", "relation": "<relación morfológica con la palabra principal>" }
    ]
  }
}

Reglas:
- collocations: exactamente 5 elementos. Cada frase debe ser un patrón frecuente que los nativos realmente usan (p.ej. "correr un maratón", "correr un riesgo", "correr a casa"). Nunca generes colocaciones que sean simplemente un sustantivo compuesto con la palabra analizada. La palabra debe aparecer tal como se usa de forma natural en el habla o escritura fluida. Excluye jerga de programación y exclamaciones puntuadas aisladas.
- synonyms: hasta 4 elementos. Incluye SOLO palabras atestiguadas en diccionarios estándar. NUNCA derives ni inventes formas morfológicamente. Si la palabra tiene pocos sinónimos reales, devuelve menos elementos. Dos palabras reales son infinitamente mejores que cinco inventadas. Un sinónimo debe poder sustituir a la palabra en una oración con significado similar — los conceptos hermanos de la misma categoría (otras frutas para una fruta, otros animales para un animal) NO son sinónimos, y tampoco lo son las categorías padre (p.ej. "fruta" para "manzana", "animal" para "perro", "vehículo" para "coche"). Para sustantivos concretos sin verdaderos sinónimos, devuelve variantes regionales o dialectales del mismo referente si existen; de lo contrario, devuelve un array vacío [].
- wordFamily: hasta 4 elementos. Incluye SOLO palabras atestiguadas en diccionarios estándar. NUNCA derives ni inventes formas morfológicamente (p.ej. NO añadas terminaciones a interjecciones ni inventes formas verbales/nominales inexistentes). Si la palabra tiene pocas formas derivadas o ninguna, devuelve menos elementos o un array vacío [].
- antonyms: hasta 3 elementos. Incluye SOLO palabras atestiguadas en diccionarios estándar. Si la palabra no tiene antónimos reales, usa un array vacío [].
- commonErrors: 1 o 2 elementos. Los errores deben ser equivocaciones que los estudiantes reales cometen de forma plausible: falsos amigos, confusión de género o número, interferencia de pronunciación, uso incorrecto del registro, ortografía. NUNCA uses la plantilla genérica "usar la palabra como otra categoría gramatical" a menos que esa confusión esté genuinamente documentada para esta palabra específica.
- cefr: asigna el nivel CEFR (A1/A2/B1/B2/C1/C2) que mejor representa la dificultad de esta palabra para estudiantes de español. Devuelve solo el código del nivel, nada más.
- meanings: lista los sentidos distintos de la palabra — NO debe repetir meaningInContext. IMPORTANTE: meaningInContext ya cubre el uso principal; no lo copies aquí. Para palabras polisémicas ("banco", "tipo", "cura"), incluye los sentidos secundarios y figurados no cubiertos por meaningInContext, ordenados por frecuencia de uso. Cada entrada: definition, partOfSpeech y opcionalmente un ejemplo corto. Para palabras monosémicas ("efímero", "océano", "mesa"), devuelve un array vacío [] o incluye un único sentido secundario solo si existe uno claramente distinto.
- pronunciation.phonetic: SOLO la IPA compacta entre barras (p.ej. /eˈlo/), máximo 30 caracteres. NUNCA una oración ni prosa — toda la explicación va en guide.
- Todo el contenido en español. Las claves siempre en inglés.
- No inventes etimologías ni hechos falsos. Si no estás seguro, sé conservador.
- Si la palabra es ambigua, prioriza el significado en el contexto dado.`;
}
