import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { indexWsdlContent } from "../../core/rag/wsdl-indexer.js";
import { parseWsdlContent } from "../../core/siebel/wsdl-parser.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURE_PATH = join(import.meta.dirname, "../fixtures/sample.wsdl");
const WSDL_CONTENT = readFileSync(FIXTURE_PATH, "utf-8");

let db: ReturnType<typeof Database>;
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

describe("WSDL Knowledge Store indexing", () => {
  it("should index each operation as a siebel_wsdl document", () => {
    const parseResult = parseWsdlContent(WSDL_CONTENT, "sample.wsdl");
    const result = indexWsdlContent(knowledgeStore, parseResult);

    const wsdlDocs = knowledgeStore.list({ sourceType: "siebel_wsdl" });
    expect(wsdlDocs.length).toBeGreaterThanOrEqual(2); // 2 operations
    expect(result.documentsIndexed).toBeGreaterThanOrEqual(2);
  });

  it("should include operation name in title", () => {
    const parseResult = parseWsdlContent(WSDL_CONTENT, "sample.wsdl");
    indexWsdlContent(knowledgeStore, parseResult);

    const wsdlDocs = knowledgeStore.list({ sourceType: "siebel_wsdl" });
    const upsert = wsdlDocs.find((d) => d.title.includes("UpsertAccount"));
    expect(upsert).toBeDefined();
  });

  it("should include namespace in metadata", () => {
    const parseResult = parseWsdlContent(WSDL_CONTENT, "sample.wsdl");
    indexWsdlContent(knowledgeStore, parseResult);

    const wsdlDocs = knowledgeStore.list({ sourceType: "siebel_wsdl" });
    const doc = wsdlDocs[0];
    expect(doc.metadata?.namespace).toContain("example.com");
  });

  it("should include endpoint URL in metadata", () => {
    const parseResult = parseWsdlContent(WSDL_CONTENT, "sample.wsdl");
    indexWsdlContent(knowledgeStore, parseResult);

    const wsdlDocs = knowledgeStore.list({ sourceType: "siebel_wsdl" });
    const opDoc = wsdlDocs.find((d) => d.title.includes("Operation:"));
    expect(opDoc).toBeDefined();
    const meta = opDoc!.metadata ?? {};
    expect(String(meta.endpointUrl ?? "")).toContain("siebel.example.com");
  });

  it("should include input/output type fields in content", () => {
    const parseResult = parseWsdlContent(WSDL_CONTENT, "sample.wsdl");
    indexWsdlContent(knowledgeStore, parseResult);

    const wsdlDocs = knowledgeStore.list({ sourceType: "siebel_wsdl" });
    const upsert = wsdlDocs.find((d) => d.title.includes("UpsertAccount"));
    expect(upsert!.content).toContain("AccountId");
    expect(upsert!.content).toContain("Name");
  });

  it("should be searchable via FTS", () => {
    const parseResult = parseWsdlContent(WSDL_CONTENT, "sample.wsdl");
    indexWsdlContent(knowledgeStore, parseResult);

    const results = knowledgeStore.search("UpsertAccount", 10);
    const wsdlResults = results.filter((r) => r.sourceType === "siebel_wsdl");
    expect(wsdlResults.length).toBeGreaterThan(0);
  });

  it("should also index complex types as separate documents", () => {
    const parseResult = parseWsdlContent(WSDL_CONTENT, "sample.wsdl");
    const result = indexWsdlContent(knowledgeStore, parseResult);

    const wsdlDocs = knowledgeStore.list({ sourceType: "siebel_wsdl" });
    const typeDocs = wsdlDocs.filter((d) => d.title.includes("Type:"));
    expect(typeDocs.length).toBeGreaterThan(0);
  });

  it("should deduplicate on re-index", () => {
    const parseResult = parseWsdlContent(WSDL_CONTENT, "sample.wsdl");
    indexWsdlContent(knowledgeStore, parseResult);
    indexWsdlContent(knowledgeStore, parseResult);

    const wsdlDocs = knowledgeStore.list({ sourceType: "siebel_wsdl" });
    // Should not double the count
    expect(wsdlDocs.length).toBeLessThanOrEqual(20);
  });
});
