// Single source of truth for pulling raw JSON out of a model response. Free
// models sometimes wrap their JSON in ```json fences or add a stray prefix, and
// the app previously had five slightly-different strippers (client + four
// schemas) that could diverge. This one handles both shapes: a fenced block
// anywhere in the text, or a bare object with leading/trailing fence markers.
export function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  // Prefer the first fenced block if present (non-greedy so nested/extra text
  // after the closing fence is ignored).
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1].trim();
  return trimmed;
}
