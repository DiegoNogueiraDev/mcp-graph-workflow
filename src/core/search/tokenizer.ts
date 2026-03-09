/**
 * Lightweight tokenizer for TF-IDF computation.
 * Handles Portuguese and English text, strips accents and punctuation.
 */

const STOPWORDS = new Set([
  // Portuguese
  "a", "o", "e", "é", "de", "do", "da", "dos", "das", "em", "no", "na",
  "nos", "nas", "um", "uma", "uns", "umas", "por", "para", "com", "sem",
  "que", "se", "ou", "ao", "aos", "como", "mais", "mas", "este", "esta",
  "esse", "essa", "não", "nao", "ser", "ter", "foi", "são", "sao",
  // English
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "of", "in", "to", "for",
  "with", "on", "at", "by", "from", "as", "into", "through", "and",
  "but", "or", "not", "no", "if", "it", "its", "this", "that", "they",
  "we", "he", "she", "you", "i", "me", "my", "your", "his", "her",
  "our", "their", "what", "which", "who", "when", "where", "how",
]);

/**
 * Normalize and tokenize text into lowercase terms, stripping accents.
 */
export function tokenize(text: string): string[] {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9_\s]/g, " ")   // keep only alphanumeric + underscore
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];

  return normalized
    .split(" ")
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}
