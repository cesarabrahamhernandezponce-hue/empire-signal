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

  return `Analyze the English word below and return a linguistic analysis as a JSON object.

Word: "${word}"
Context: ${contextText}
Tone: ${toneInstruction}

Required JSON structure (fill every field with real content — no placeholder text):

{
  "version": 1,
  "essential": {
    "meaningInContext": "<precise meaning in context>",
    "wordType": {
      "category": "<one of: noun|verb|adjective|adverb|preposition|conjunction|interjection|pronoun>",
      "explanation": "<grammatical function in this context>"
    },
    "pronunciation": {
      "phonetic": "<IPA transcription>",
      "guide": "<plain-English pronunciation guide, no symbols>"
    },
    "usageExamples": [
      { "register": "formal",    "example": "<sentence>" },
      { "register": "technical", "example": "<sentence>" },
      { "register": "everyday",  "example": "<sentence>" }
    ],
    "collocations": [
      { "phrase": "<collocation>", "meaning": "<usage>" },
      { "phrase": "<collocation>", "meaning": "<usage>" },
      { "phrase": "<collocation>", "meaning": "<usage>" },
      { "phrase": "<collocation>", "meaning": "<usage>" },
      { "phrase": "<collocation>", "meaning": "<usage>" }
    ],
    "mnemonic": "<original mnemonic to remember the meaning>"
  },
  "advanced": {
    "etymology": "<origin and historical evolution>",
    "story": "<brief cultural narrative about the word>",
    "synonyms": [
      { "word": "<synonym>", "nuance": "<how it differs from the main word>" },
      { "word": "<synonym>", "nuance": "<how it differs from the main word>" },
      { "word": "<synonym>", "nuance": "<how it differs from the main word>" },
      { "word": "<synonym>", "nuance": "<how it differs from the main word>" }
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
- collocations: exactly 5 items.
- synonyms: exactly 4 items.
- wordFamily: exactly 4 items.
- antonyms: exactly 3 items. If the word has no real antonyms, use an empty array [].
- commonErrors: 1 or 2 items.
- All content in English. Keys always in English.
- No invented etymologies or false facts. If uncertain, be conservative.
- Prioritize the meaning in the given context if the word is ambiguous.`;
}
