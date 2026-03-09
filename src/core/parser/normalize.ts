/**
 * Stage 1: Text normalization.
 * - Standardize line endings
 * - Remove duplicate blank lines
 * - Trim whitespace
 * - Standardize bullet markers to "-"
 */
export function normalize(raw: string): string {
  let text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Collapse 3+ consecutive blank lines into 2
  text = text.replace(/\n{3,}/g, "\n\n");

  // Standardize bullet markers: *, •, ● → -
  text = text.replace(/^(\s*)[*•●]\s/gm, "$1- ");

  // Trim trailing whitespace per line
  text = text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

  return text;
}
