import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { KnowledgeStore } from "../core/store/knowledge-store.js";
import { indexCapture } from "../core/rag/capture-indexer.js";
import type { CaptureResult } from "../core/capture/web-capture.js";

function makeCaptureResult(overrides?: Partial<CaptureResult>): CaptureResult {
  return {
    text: "This is captured web content about software development.",
    title: "Test Page",
    description: "A test page",
    wordCount: 8,
    url: "https://example.com/test",
    capturedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("CaptureIndexer", () => {
  let store: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    knowledgeStore = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  it("should index a web capture result", () => {
    const capture = makeCaptureResult();
    const result = indexCapture(knowledgeStore, capture);

    expect(result.documentsIndexed).toBe(1);
    expect(result.url).toBe("https://example.com/test");
    expect(knowledgeStore.count("web_capture")).toBe(1);
  });

  it("should store capture metadata", () => {
    const capture = makeCaptureResult();
    indexCapture(knowledgeStore, capture);

    const docs = knowledgeStore.list({ sourceType: "web_capture" });
    expect(docs[0].metadata?.url).toBe("https://example.com/test");
    expect(docs[0].metadata?.wordCount).toBe(8);
  });

  it("should chunk large captures", () => {
    const capture = makeCaptureResult({
      text: "Long paragraph about testing. ".repeat(200),
    });

    const result = indexCapture(knowledgeStore, capture);

    expect(result.documentsIndexed).toBeGreaterThan(1);
  });

  it("should replace previous capture of the same URL", () => {
    const capture1 = makeCaptureResult({ text: "Version 1 content" });
    indexCapture(knowledgeStore, capture1);
    expect(knowledgeStore.count("web_capture")).toBe(1);

    const capture2 = makeCaptureResult({ text: "Version 2 updated content" });
    indexCapture(knowledgeStore, capture2);
    expect(knowledgeStore.count("web_capture")).toBe(1);

    const docs = knowledgeStore.list({ sourceType: "web_capture" });
    expect(docs[0].content).toContain("Version 2");
  });

  it("should return zero for empty content", () => {
    const capture = makeCaptureResult({ text: "" });
    const result = indexCapture(knowledgeStore, capture);

    expect(result.documentsIndexed).toBe(0);
  });

  it("should handle multiple different URLs", () => {
    indexCapture(knowledgeStore, makeCaptureResult({ url: "https://a.com" }));
    indexCapture(knowledgeStore, makeCaptureResult({ url: "https://b.com" }));

    expect(knowledgeStore.count("web_capture")).toBe(2);
  });
});
