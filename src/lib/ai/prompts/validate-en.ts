export function buildValidatePromptEN(sentence: string, word: string): string {
  return `You are a linguistic naturalness evaluator. A user wrote a sentence using the English word "${word}".

Sentence: "${sentence}"

Evaluate how natural this sentence sounds to a native English speaker. Consider grammar, word choice, idiomaticity, and flow.

Respond with ONLY a JSON object. No markdown, no explanation, no code block:
{
  "natural": boolean,
  "score": number between 0 and 100,
  "feedback": "max 2 sentences of plain text feedback",
  "suggestion": "improved version of the sentence only if natural is false, otherwise null"
}`;
}
