export function buildValidatePromptEN(sentence: string, word: string): string {
  return `Respond entirely in English. All feedback and suggestions must be written in English regardless of the language of the sentence provided.

Evaluate this sentence that uses the word "${word}".

Sentence: "${sentence}"

Score the sentence from 0-100 using ONLY these fixed criteria:
- Word used with correct meaning in this context: +40 points
- Grammar is correct: +30 points
- Register matches the word's level (formal/informal): +20 points
- Sentence sounds natural to a native speaker: +10 points
Deduct points only for clear, objective errors.
Apply these criteria mechanically — the score must be the same if the same sentence is evaluated twice.

Set "natural" to true if score >= 75, false otherwise.

Return a JSON object with exactly these fields:
- "natural": true or false
- "score": integer from 0 to 100
- "feedback": 1-2 sentences of plain text feedback
- "suggestion": improved sentence if natural is false, otherwise null`;
}
