export function buildAnalyzePromptEN(
  word: string,
  context: string | null,
): string {
  const contextText = context?.trim() || 'No specific context provided.';

  return `Analyze the English word below and return a linguistic analysis as a JSON object.

Word: "${word}"
Context: ${contextText}

Required JSON structure (fill every field with real content — no placeholder text):

{
  "version": 1,
  "essential": {
    "cefr": "<CEFR level code — one of: A1, A2, B1, B2, C1, C2>",
    "meaningInContext": "<precise meaning in context>",
    "wordType": {
      "category": "<one of: noun|verb|adjective|adverb|preposition|conjunction|interjection|pronoun>",
      "explanation": "<grammatical function in this context>"
    },
    "pronunciation": {
      "phonetic": "<IPA transcription>",
      "guide": "<2-sentence max prose guide: explain which syllable carries the stress, describe tricky sounds using familiar reference words (e.g. 'the o sounds like in go'), flag any sounds non-native speakers find difficult. Never reproduce IPA. Never use capital letters to mark stress — describe it in words instead.>"
    },
    "usageExamples": [
      { "register": "formal",    "example": "<sentence>" },
      { "register": "technical", "example": "<sentence>" },
      { "register": "everyday",  "example": "<sentence>" }
    ],
    "collocations": [
      { "phrase": "<natural phrase using the word in real context, e.g. 'run a marathon'>", "meaning": "<usage>" },
      { "phrase": "<natural phrase using the word in real context, e.g. 'run out of time'>", "meaning": "<usage>" },
      { "phrase": "<natural phrase using the word in real context, e.g. 'run a business'>", "meaning": "<usage>" },
      { "phrase": "<natural phrase using the word in real context>", "meaning": "<usage>" },
      { "phrase": "<natural phrase using the word in real context>", "meaning": "<usage>" }
    ],
    "meanings": [
      { "definition": "<first and most common meaning>", "partOfSpeech": "<noun|verb|adjective|etc>", "example": "<optional short sentence>" }
    ]
  },
  "advanced": {
    "etymology": "<origin and historical evolution>",
    "story": "<brief cultural narrative about the word>",
    "synonyms": [
      { "word": "<synonym>", "nuance": "<explain what this word means and when to use it, in ONE sentence — focus on the word itself, do NOT compare it to the searched word, do NOT reference the original word at all (e.g. 'geometer: a specialist in geometry, typically used in academic or historical contexts.')>" },
      { "word": "<synonym>", "nuance": "<explain what this word means and when to use it, in ONE sentence — focus on the word itself, do NOT compare it to the searched word, do NOT reference the original word at all>" },
      { "word": "<synonym>", "nuance": "<explain what this word means and when to use it, in ONE sentence — focus on the word itself, do NOT compare it to the searched word, do NOT reference the original word at all>" },
      { "word": "<synonym>", "nuance": "<explain what this word means and when to use it, in ONE sentence — focus on the word itself, do NOT compare it to the searched word, do NOT reference the original word at all>" }
    ],
    "antonyms": [
      { "word": "<antonym>", "context": "<in what context it is an antonym>" },
      { "word": "<antonym>", "context": "<in what context it is an antonym>" },
      { "word": "<antonym>", "context": "<in what context it is an antonym>" }
    ],
    "registerLevel": {
      "level": "<one of: formal|technical|colloquial|vulgar>",
      "guidance": "<when it is appropriate to use this word>"
    },
    "commonErrors": [
      { "error": "<typical mistake>", "correction": "<correct form and why>" }
    ],
    "wordFamily": [
      { "word": "<derivative>", "relation": "<morphological relation to the main word>" },
      { "word": "<derivative>", "relation": "<morphological relation to the main word>" },
      { "word": "<derivative>", "relation": "<morphological relation to the main word>" },
      { "word": "<derivative>", "relation": "<morphological relation to the main word>" }
    ]
  }
}

Rules:
- collocations: exactly 5 items. Each phrase must be a natural expression where the word is used in real context (e.g. "run a marathon", "run out of time", "run a business"). Never generate collocations that are just a noun compounded with the analyzed word (e.g. NOT "marathon run", "business run"). The word must appear as it naturally does in fluent speech or writing.
- synonyms: exactly 4 items.
- wordFamily: exactly 4 items.
- antonyms: exactly 3 items. If the word has no real antonyms, use an empty array [].
- commonErrors: 1 or 2 items.
- cefr: assign the CEFR level (A1/A2/B1/B2/C1/C2) that best represents this word's difficulty for English learners. Return only the level code, nothing else.
- meanings: if the word is polysemous (multiple distinct meanings across different parts of speech or usage contexts — e.g. "type", "run", "set", "bank", "get"), populate "meanings" as an array of ALL relevant meanings ordered by frequency of use. Each entry: definition, partOfSpeech, and optionally a short example sentence. If the word has one clear primary meaning ("ephemeral", "ocean", "table"), return a single-element array with that meaning only.
- All content in English. Keys always in English.
- No invented etymologies or false facts. If uncertain, be conservative.
- Prioritize the meaning in the given context if the word is ambiguous.`;
}
