import type { Tone } from './types';

const TONE_INSTRUCTIONS: Record<Tone, string> = {
  practico:  'Use a practical and direct register. Focused on how to use the word in real situations.',
  academico: 'Use an academic and formal register. Technical terminology, reference to authors or sources if applicable.',
  creativo:  'Use a creative and narrative register. Metaphors, poetic images, make it memorable.',
  infantil:  'Explain as if the user is 12 years old. Simple, clear, with everyday examples.',
};

export function buildAnalyzePromptEN(
  word: string,
  context: string | null,
  tone: Tone,
): string {
  const contextText = context?.trim() || 'No specific context provided.';
  const toneInstruction = TONE_INSTRUCTIONS[tone];

  return `You are Empire Signal, an expert linguistic analyzer. Analyze the following word in English and return a deep, precise analysis.

Word: "${word}"
Context: ${contextText}
Tone: ${toneInstruction}

Return EXCLUSIVELY the following valid JSON object, respecting the exact structure:

{
  "version": 1,
  "essential": {
    "meaningInContext": "Precise meaning of the word in the given context.",
    "wordType": {
      "category": "noun|verb|adjective|adverb|preposition|conjunction|interjection|pronoun",
      "explanation": "Brief explanation of its grammatical function in this context."
    },
    "pronunciation": {
      "phonetic": "IPA phonetic transcription.",
      "guide": "Simple pronunciation guide in plain English, without technical symbols."
    },
    "usageExamples": [
      { "register": "formal",    "example": "Example sentence in formal register." },
      { "register": "technical", "example": "Example sentence in technical register." },
      { "register": "everyday",  "example": "Example sentence in everyday register." }
    ],
    "collocations": [
      { "phrase": "natural collocation 1", "meaning": "Meaning or usage." },
      { "phrase": "natural collocation 2", "meaning": "Meaning or usage." },
      { "phrase": "natural collocation 3", "meaning": "Meaning or usage." },
      { "phrase": "natural collocation 4", "meaning": "Meaning or usage." },
      { "phrase": "natural collocation 5", "meaning": "Meaning or usage." }
    ],
    "mnemonic": "Original mnemonic trick to remember the meaning of the word."
  },
  "advanced": {
    "etymology": "Origin and historical evolution of the word.",
    "story": "Brief and memorable cultural narrative about the word or its use.",
    "synonyms": [
      { "word": "synonym 1", "nuance": "Nuance that differentiates it from the main word." },
      { "word": "synonym 2", "nuance": "Nuance that differentiates it from the main word." },
      { "word": "synonym 3", "nuance": "Nuance that differentiates it from the main word." },
      { "word": "synonym 4", "nuance": "Nuance that differentiates it from the main word." }
    ],
    "antonyms": [
      { "word": "antonym 1", "context": "In what context it is an antonym." },
      { "word": "antonym 2", "context": "In what context it is an antonym." },
      { "word": "antonym 3", "context": "In what context it is an antonym." }
    ],
    "registerLevel": {
      "level": "formal|technical|colloquial|vulgar",
      "guidance": "Explanation of in which situations it is appropriate to use this word."
    },
    "commonErrors": [
      { "error": "Typical error when using this word.", "correction": "Correct form and why." }
    ],
    "wordFamily": [
      { "word": "derivative 1", "relation": "Morphological relation to the main word." },
      { "word": "derivative 2", "relation": "Morphological relation to the main word." },
      { "word": "derivative 3", "relation": "Morphological relation to the main word." },
      { "word": "derivative 4", "relation": "Morphological relation to the main word." }
    ]
  }
}

Mandatory rules:
- Return EXCLUSIVELY the JSON object. Do not use markdown, do not use code blocks with backticks, do not include any text before or after the JSON.
- All content inside the JSON must be in English.
- JSON keys ALWAYS in English.
- collocations must have exactly 5 elements.
- synonyms must have exactly 4 elements.
- wordFamily must have exactly 4 elements.
- antonyms must have exactly 3 elements. If the word has no real antonyms, return an empty array [] instead of inventing false antonyms.
- commonErrors can have 1 or 2 elements.
- Be precise. Do not invent etymologies, data, or false facts. If unsure about something, be conservative.
- If the word is ambiguous, prioritize the meaning in the given context.`;
}
