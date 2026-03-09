/**
 * Lightweight token estimation using the ~4 chars/token heuristic.
 * This matches the industry-standard approximation used by OpenAI/Anthropic tokenizers
 * for English text. Good enough for budget estimation without a full tokenizer dependency.
 */

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
