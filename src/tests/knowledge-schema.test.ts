import { describe, it, expect } from "vitest";
import { KnowledgeDocumentSchema, KnowledgeSourceTypeSchema } from "../schemas/knowledge.schema.js";

describe("KnowledgeDocumentSchema", () => {
  const validDoc = {
    id: "kdoc_abc123",
    sourceType: "upload",
    sourceId: "file-001",
    title: "API Design Guide",
    content: "REST API best practices",
    contentHash: "abc123def456",
    chunkIndex: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  it("should validate a correct knowledge document", () => {
    const result = KnowledgeDocumentSchema.safeParse(validDoc);
    expect(result.success).toBe(true);
  });

  it("should accept optional metadata", () => {
    const result = KnowledgeDocumentSchema.safeParse({
      ...validDoc,
      metadata: { url: "https://example.com", pages: 5 },
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing required fields", () => {
    const { title: _, ...noTitle } = validDoc;
    const result = KnowledgeDocumentSchema.safeParse(noTitle);
    expect(result.success).toBe(false);
  });

  it("should reject negative chunk index", () => {
    const result = KnowledgeDocumentSchema.safeParse({ ...validDoc, chunkIndex: -1 });
    expect(result.success).toBe(false);
  });
});

describe("KnowledgeSourceTypeSchema", () => {
  it("should accept all valid source types", () => {
    const types = ["upload", "serena", "memory", "code_context", "docs", "web_capture"];
    for (const type of types) {
      expect(KnowledgeSourceTypeSchema.safeParse(type).success).toBe(true);
    }
  });

  it("should reject invalid source type", () => {
    expect(KnowledgeSourceTypeSchema.safeParse("invalid").success).toBe(false);
  });
});
