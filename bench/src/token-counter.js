/**
 * Token Counter: Approximates LLM tokenizer behavior (GPT-4 / Claude / Gemini BPE)
 * Uses Unicode-aware token chunking regex mirroring cl100k_base / Llama / Claude.
 */
const TOKEN_REGEX = /(?:[A-Za-z]+|[\d]+|[^\s\w]+|\s+)/gu;

export function countTokens(text) {
  if (!text) return 0;
  const matches = text.match(TOKEN_REGEX);
  return matches ? matches.length : 0;
}

export function measureTextStats(text) {
  const chars = text ? text.length : 0;
  const bytes = text ? Buffer.byteLength(text, 'utf8') : 0;
  const tokens = countTokens(text);
  const lines = text ? text.split('\n').length : 0;

  return {
    tokens,
    chars,
    bytes,
    lines
  };
}
