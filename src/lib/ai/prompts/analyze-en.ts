export function buildAnalyzePromptEN(
  word: string,
  context: string | null,
): string {
  const contextText = context?.trim() || 'No specific context provided.';

  return `Analyze the English word below and return a linguistic analysis as a JSON object.

IMPORTANT — CANONICAL FORM: Before analyzing, normalize the input to its correct canonical English spelling, restoring diacritics ONLY when the standard spelling genuinely uses them and the intended word is unambiguous (e.g. "cafe" → "café", "naive" → "naïve", "resume" stays "resume"). Never invent diacritics for ordinary words. Analyze that canonical form and return it (lowercase) in the "word" field.

Word: "${word}"
Context: ${contextText}

Required JSON structure (fill every field with real content — no placeholder text):

{
  "version": 1,
  "word": "<canonical spelling of the word, lowercase, diacritics restored only if standard>",
  "essential": {
    "cefr": "<CEFR level code — one of: A1, A2, B1, B2, C1, C2>",
    "meaningInContext": "<precise meaning in context>",
    "wordType": {
      "category": "<one of: noun|verb|adjective|adverb|preposition|conjunction|interjection|pronoun>",
      "explanation": "<grammatical function in this context>"
    },
    "pronunciation": {
      "phonetic": "<ONLY the compact IPA transcription between slashes, e.g. /həˈloʊ/ — maximum 30 characters, NEVER a sentence or explanation. Leave empty string if uncertain.>",
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
      { "word": "<antonym — ONLY if attested in standard dictionaries>", "context": "<in what context it is an antonym>" },
      { "word": "<antonym — ONLY if attested in standard dictionaries>", "context": "<in what context it is an antonym>" },
      { "word": "<antonym — ONLY if attested in standard dictionaries>", "context": "<in what context it is an antonym>" }
    ],
    "registerLevel": {
      "level": "<one of: formal|technical|colloquial|vulgar>",
      "guidance": "<when it is appropriate to use this word>"
    },
    "commonErrors": [
      { "error": "<typical mistake>", "correction": "<correct form and why>" }
    ],
    "wordFamily": [
      { "word": "<derivative — ONLY if attested in standard dictionaries>", "relation": "<morphological relation to the main word>" },
      { "word": "<derivative — ONLY if attested in standard dictionaries>", "relation": "<morphological relation to the main word>" },
      { "word": "<derivative — ONLY if attested in standard dictionaries>", "relation": "<morphological relation to the main word>" },
      { "word": "<derivative — ONLY if attested in standard dictionaries>", "relation": "<morphological relation to the main word>" }
    ]
  }
}

Rules:
- collocations: exactly 5 items. Each phrase must be a frequent multi-word pattern natives actually use (e.g. "run a marathon", "run out of time", "run a business"). Never generate collocations that are just a noun compounded with the analyzed word. The word must appear as it naturally does in fluent speech or writing. Exclude programming jargon (e.g. "hello world") and standalone punctuated interjections (e.g. "hello?").
- synonyms: up to 4 items. Include ONLY words attested in standard dictionaries. NEVER derive or invent forms morphologically. If the word has few true synonyms, return fewer items. Two real words are infinitely better than five invented ones. A synonym must be substitutable for the word in a sentence with similar meaning — sibling concepts of the same category (other fruits for a fruit, other animals for an animal) are NOT synonyms, and neither are parent categories (e.g. "fruit" for "apple", "animal" for "dog", "vehicle" for "car"). For concrete nouns with no true synonyms, return regional/dialectal variants of the same referent if they exist, otherwise return an empty array [].
- wordFamily: up to 4 items. Include ONLY words attested in standard dictionaries. NEVER derive or invent forms morphologically (e.g. do NOT add -ing/-ed to interjections or invent noun/verb forms that don't exist). If the word has few or no derived forms, return fewer items or an empty array [].
- antonyms: up to 3 items. Include ONLY words attested in standard dictionaries. If the word has no real antonyms, use an empty array [].
- commonErrors: 1 or 2 items. Errors must be mistakes real learners plausibly make: false friends, confusion between similar words, pronunciation interference, register misuse, spelling. NEVER use the generic template "using the word as a different part of speech" unless that confusion is genuinely documented for this specific word.
- cefr: assign the CEFR level (A1/A2/B1/B2/C1/C2) that best represents this word's difficulty for English learners. Return only the level code, nothing else.
- meanings: lists the word's distinct senses — NOT a repeat of meaningInContext. IMPORTANT: meaningInContext already covers the primary use; do NOT copy it here. For polysemous words ("type", "run", "bank"), populate with secondary and figurative senses not covered by meaningInContext, ordered by frequency of use. Each entry: definition, partOfSpeech, and optionally a short example sentence. For monosemous words ("ephemeral", "ocean", "table"), return an empty array [] or include one secondary sense only if a meaningfully distinct one exists.
- pronunciation.phonetic: ONLY the compact IPA between slashes (e.g. /həˈloʊ/), 30 characters max. NEVER a sentence, never prose — all explanation goes in guide.
- All content in English. Keys always in English.
- No invented etymologies or false facts. If uncertain, be conservative.
- Prioritize the meaning in the given context if the word is ambiguous.`;
}
