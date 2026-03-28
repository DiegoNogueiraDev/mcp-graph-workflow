import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { indexSifContent } from "../../core/rag/siebel-indexer.js";
import { parseSifContent } from "../../core/siebel/sif-parser.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FIXTURE_PATH = join(import.meta.dirname, "../fixtures/sample-escript.sif");
const SIF_CONTENT = readFileSync(FIXTURE_PATH, "utf-8");

let db: ReturnType<typeof Database>;
let knowledgeStore: KnowledgeStore;

beforeEach(() => {
  db = new Database(":memory:");
  // Create knowledge_documents table
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

describe("eScript indexing into Knowledge Store", () => {
  it("should index eScript children with source_type siebel_escript", () => {
    const parseResult = parseSifContent(SIF_CONTENT, "test-escript.sif");
    const _result = indexSifContent(knowledgeStore, parseResult);

    const escriptDocs = knowledgeStore.list({ sourceType: "siebel_escript" });
    expect(escriptDocs.length).toBeGreaterThan(0);
  });

  it("should include parent_object in eScript metadata", () => {
    const parseResult = parseSifContent(SIF_CONTENT, "test-escript.sif");
    indexSifContent(knowledgeStore, parseResult);

    const escriptDocs = knowledgeStore.list({ sourceType: "siebel_escript" });
    const doc = escriptDocs.find((d) => d.title.includes("WebApplet_PreInvokeMethod"));
    expect(doc).toBeDefined();
    expect(doc!.metadata?.parentObject).toBeDefined();
  });

  it("should include method_name and program_language in metadata", () => {
    const parseResult = parseSifContent(SIF_CONTENT, "test-escript.sif");
    indexSifContent(knowledgeStore, parseResult);

    const escriptDocs = knowledgeStore.list({ sourceType: "siebel_escript" });
    const doc = escriptDocs.find((d) => d.title.includes("BusComp_PreWriteRecord"));
    expect(doc).toBeDefined();
    expect(doc!.metadata?.methodName).toBe("BusComp_PreWriteRecord");
    expect(doc!.metadata?.programLanguage).toBe("JS");
  });

  it("should include line_count in metadata", () => {
    const parseResult = parseSifContent(SIF_CONTENT, "test-escript.sif");
    indexSifContent(knowledgeStore, parseResult);

    const escriptDocs = knowledgeStore.list({ sourceType: "siebel_escript" });
    const doc = escriptDocs.find((d) => d.title.includes("BusComp_SetFieldValue"));
    expect(doc).toBeDefined();
    expect(doc!.metadata?.lineCount).toBeGreaterThan(0);
  });

  it("should include source code in content for searchability", () => {
    const parseResult = parseSifContent(SIF_CONTENT, "test-escript.sif");
    indexSifContent(knowledgeStore, parseResult);

    const escriptDocs = knowledgeStore.list({ sourceType: "siebel_escript" });
    const doc = escriptDocs.find((d) => d.title.includes("BusComp_SetFieldValue"));
    expect(doc).toBeDefined();
    expect(doc!.content).toContain("GetService");
    expect(doc!.content).toContain("InvokeMethod");
  });

  it("should be searchable via knowledge store FTS", () => {
    const parseResult = parseSifContent(SIF_CONTENT, "test-escript.sif");
    indexSifContent(knowledgeStore, parseResult);

    const results = knowledgeStore.search("RaiseErrorText", 10);
    const escriptResults = results.filter((r) => r.sourceType === "siebel_escript");
    expect(escriptResults.length).toBeGreaterThan(0);
  });

  it("should still index regular siebel_sif objects", () => {
    const parseResult = parseSifContent(SIF_CONTENT, "test-escript.sif");
    const result = indexSifContent(knowledgeStore, parseResult);

    const sifDocs = knowledgeStore.list({ sourceType: "siebel_sif" });
    expect(sifDocs.length).toBeGreaterThan(0);
    expect(result.documentsIndexed).toBeGreaterThan(0);
  });
});
