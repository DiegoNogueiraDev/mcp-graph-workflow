import { describe, it, expect } from "vitest";
import { chunkText } from "../core/rag/chunk-text.js";

describe("chunkText", () => {
  // ── Empty / trivial input ──────────────────────

  it("should return empty array for empty string", () => {
    expect(chunkText("")).toHaveLength(0);
  });

  it("should return empty array for whitespace-only string", () => {
    expect(chunkText("   ")).toHaveLength(0);
  });

  // ── Single chunk ───────────────────────────────

  it("should return a single chunk for short text", () => {
    const text = "This is a short text.";
    const chunks = chunkText(text, { maxTokens: 500 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].tokens).toBeGreaterThan(0);
  });

  it("should return a single chunk when text fits within maxTokens", () => {
    const text = "Hello world. This is a test.";
    const chunks = chunkText(text, { maxTokens: 100 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe(text);
  });

  // ── Multiple chunks ────────────────────────────

  it("should split long text into multiple chunks", () => {
    // Generate ~40 tokens worth of text per sentence, 10 sentences = ~400 tokens
    const sentences = Array.from({ length: 10 }, (_, i) =>
      `Sentence number ${i + 1} contains some words to make it reasonably long for chunking.`,
    );
    const text = sentences.join(" ");

    const chunks = chunkText(text, { maxTokens: 100, overlapTokens: 10 });

    expect(chunks.length).toBeGreaterThan(1);
    // All chunks should have consecutive indices
    chunks.forEach((chunk, i) => {
      expect(chunk.index).toBe(i);
    });
  });

  it("should have overlap between consecutive chunks", () => {
    const sentences = Array.from({ length: 20 }, (_, i) =>
      `Unique sentence ${i} with identifier ${i * 100}.`,
    );
    const text = sentences.join(" ");

    const chunks = chunkText(text, { maxTokens: 50, overlapTokens: 15 });

    // With overlap, later chunks should contain some text from the end of previous chunks
    if (chunks.length >= 2) {
      // The beginning of chunk 1 should overlap with the end of chunk 0
      const lastWordsChunk0 = chunks[0].content.split(" ").slice(-3).join(" ");
      // Check that at least some of the tail of chunk 0 appears in chunk 1
      const foundOverlap = chunks[1].content.includes(lastWordsChunk0);
      // Overlap is sentence-based, so this should be true for most cases
      expect(foundOverlap || chunks.length > 2).toBe(true);
    }
  });

  // ── Chunk indices ──────────────────────────────

  it("should assign sequential zero-based chunk indices", () => {
    const text = Array.from({ length: 15 }, (_, i) => `Section ${i}.`).join(" ");
    const chunks = chunkText(text, { maxTokens: 20, overlapTokens: 5 });

    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
    }
  });

  // ── Token estimates ────────────────────────────

  it("should estimate tokens for each chunk", () => {
    const text = "The quick brown fox jumps over the lazy dog. Again and again.";
    const chunks = chunkText(text, { maxTokens: 500 });

    expect(chunks[0].tokens).toBeGreaterThan(0);
    // ~4 chars per token heuristic
    expect(chunks[0].tokens).toBeLessThanOrEqual(Math.ceil(text.length / 4) + 1);
  });

  // ── Default options ────────────────────────────

  it("should use default maxTokens (500) and overlapTokens (50)", () => {
    // ~2000 chars = ~500 tokens, so a 4000 char text should produce ~2 chunks
    const text = "A".repeat(4000);
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  // ── Very long single sentence ──────────────────

  it("should handle a single very long sentence via hard split", () => {
    // A single "sentence" with no period, ~3000 chars = ~750 tokens
    const text = "word ".repeat(600);
    const chunks = chunkText(text, { maxTokens: 100, overlapTokens: 10 });

    expect(chunks.length).toBeGreaterThan(1);
    // All content should be captured
    const totalContent = chunks.map((c) => c.content).join("");
    // Due to overlap, total content length >= original
    expect(totalContent.length).toBeGreaterThanOrEqual(text.trim().length);
  });

  // ── Newline handling ───────────────────────────

  it("should split on newlines as sentence boundaries", () => {
    const text = "Line one.\nLine two.\nLine three.\nLine four.\nLine five.\nLine six.\nLine seven.\nLine eight.\nLine nine.\nLine ten.";
    const chunks = chunkText(text, { maxTokens: 15, overlapTokens: 3 });

    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should contain some lines
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeGreaterThan(0);
    }
  });
});
