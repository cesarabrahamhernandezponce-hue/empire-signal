export function buildValidatePromptEN(sentence: string, word: string): string {
  return `Evaluate how natural this sentence sounds to a native English speaker. The sentence uses the word "${word}".

Sentence: "${sentence}"

Consider: grammar, word choice, idiomaticity, and flow.

Return a JSON object with exactly these fields:
- "natural": true or false
- "score": integer from 0 to 100
- "feedback": 1-2 sentences of plain text feedback
- "suggestion": improved sentence if natural is false, otherwise null`;
}
