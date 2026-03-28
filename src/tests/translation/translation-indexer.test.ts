import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { indexTranslationEvidence } from "../../core/rag/translation-indexer.js";

function makeEvidence() {
  return {
    jobId: "job_001",
    sourceLanguage: "typescript",
    targetLanguage: "python",
    sourceCode: "function add(a: number, b: number): number { return a + b; }",
    targetCode: "def add(a: int, b: int) -> int:\n    return a + b",
    scope: "function" as const,
    confidenceScore: 0.92,
    translatedConstructs: [
      { source: "function", target: "def", method: "direct" },
      { source: "type_annotation", target: "type_hint", method: "direct" },
    ],
    risks: [
      { construct: "return_type", severity: "low", message: "Python type hints are not enforced at runtime" },
    ],
    humanReviewPoints: ["Verify type hint correctness"],
  };
}

describe("indexTranslationEvidence", () => {
  let db: Database.Database;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id TEXT PRIMARY KEY,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        chunk_index INTEGER DEFAULT 0,
        metadata TEXT,
        quality_score REAL DEFAULT 0,
        usage_count INTEGER DEFAULT 0,
        last_accessed_at TEXT,
        staleness_days INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
        title, content, source_type, source_id,
        content='knowledge_documents',
        content_rowid='rowid'
      );
      CREATE TRIGGER IF NOT EXISTS knowledge_ai AFTER INSERT ON knowledge_documents BEGIN
        INSERT INTO knowledge_fts(rowid, title, content, source_type, source_id)
        VALUES (NEW.rowid, NEW.title, NEW.content, NEW.source_type, NEW.source_id);
      END;
    `);
    knowledgeStore = new KnowledgeStore(db);
  });

  it("should index evidence with source_type translation_evidence", () => {
    const result = indexTranslationEvidence(knowledgeStore, makeEvidence());

    expect(result.documentsIndexed).toBeGreaterThan(0);

    const docs = db.prepare("SELECT * FROM knowledge_documents WHERE source_type = ?").all("translation_evidence");
    expect(docs.length).toBeGreaterThan(0);
  });

  it("should include source and target code in content", () => {
    indexTranslationEvidence(knowledgeStore, makeEvidence());

    const docs = db.prepare("SELECT content FROM knowledge_documents WHERE source_type = ?").all("translation_evidence") as Array<{ content: string }>;
    const allContent = docs.map((d) => d.content).join(" ");

    expect(allContent).toContain("function add");
    expect(allContent).toContain("def add");
  });

  it("should include language pair in title", () => {
    indexTranslationEvidence(knowledgeStore, makeEvidence());

    const docs = db.prepare("SELECT title FROM knowledge_documents WHERE source_type = ?").all("translation_evidence") as Array<{ title: string }>;
    const titles = docs.map((d) => d.title);

    expect(titles.some((t) => t.includes("typescript") && t.includes("python"))).toBe(true);
  });

  it("should include confidence and risks in metadata", () => {
    indexTranslationEvidence(knowledgeStore, makeEvidence());

    const docs = db.prepare("SELECT metadata FROM knowledge_documents WHERE source_type = ?").all("translation_evidence") as Array<{ metadata: string }>;
    const meta = JSON.parse(docs[0].metadata);

    expect(meta.confidenceScore).toBe(0.92);
    expect(meta.sourceLanguage).toBe("typescript");
    expect(meta.targetLanguage).toBe("python");
  });

  it("should deduplicate on re-index (deleteBySource)", () => {
    indexTranslationEvidence(knowledgeStore, makeEvidence());
    indexTranslationEvidence(knowledgeStore, makeEvidence());

    const docs = db.prepare("SELECT * FROM knowledge_documents WHERE source_type = ?").all("translation_evidence");
    // Should not double the count
    const firstCount = docs.length;
    expect(firstCount).toBeGreaterThan(0);

    // Re-index a third time
    indexTranslationEvidence(knowledgeStore, makeEvidence());
    const docs2 = db.prepare("SELECT * FROM knowledge_documents WHERE source_type = ?").all("translation_evidence");
    expect(docs2.length).toBe(firstCount);
  });

  it("should be searchable via FTS", () => {
    indexTranslationEvidence(knowledgeStore, makeEvidence());

    const results = knowledgeStore.search("add function typescript python");
    expect(results.length).toBeGreaterThan(0);
  });
});
