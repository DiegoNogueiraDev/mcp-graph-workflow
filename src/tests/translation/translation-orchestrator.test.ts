import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { ConstructRegistry } from "../../core/translation/ucr/construct-registry.js";
import { loadAndSeedRegistry } from "../../core/translation/ucr/construct-seed.js";
import { TranslationStore } from "../../core/translation/translation-store.js";
import { TranslationOrchestrator } from "../../core/translation/translation-orchestrator.js";
import type { TranslationAnalysis } from "../../core/translation/translation-types.js";

function createTestDeps(): { db: Database.Database; registry: ConstructRegistry; store: TranslationStore } {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS ucr_categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT
    );
    CREATE TABLE IF NOT EXISTS ucr_constructs (
      id TEXT PRIMARY KEY, category_id TEXT NOT NULL, canonical_name TEXT NOT NULL UNIQUE,
      description TEXT, semantic_group TEXT, metadata TEXT DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS ucr_language_mappings (
      id TEXT PRIMARY KEY, construct_id TEXT NOT NULL, language_id TEXT NOT NULL,
      syntax_pattern TEXT, ast_node_type TEXT, confidence REAL NOT NULL DEFAULT 0.8,
      is_primary INTEGER NOT NULL DEFAULT 0, constraints TEXT DEFAULT '[]'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS ucr_constructs_fts USING fts5(
      canonical_name, description, semantic_group,
      content='ucr_constructs', content_rowid='rowid'
    );
    CREATE TABLE IF NOT EXISTS translation_jobs (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
      source_language TEXT NOT NULL, target_language TEXT NOT NULL,
      source_code TEXT NOT NULL, target_code TEXT,
      status TEXT NOT NULL DEFAULT 'pending', scope TEXT NOT NULL DEFAULT 'snippet',
      constraints TEXT, analysis TEXT, result TEXT, evidence TEXT,
      confidence_score REAL, warnings TEXT, error_message TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);
  const registry = new ConstructRegistry(db);
  loadAndSeedRegistry(registry);
  const store = new TranslationStore(db);
  return { db, registry, store };
}

describe("TranslationOrchestrator", () => {
  let orchestrator: TranslationOrchestrator;
  let store: TranslationStore;

  beforeEach(() => {
    const deps = createTestDeps();
    store = deps.store;
    orchestrator = new TranslationOrchestrator(deps.registry, deps.store);
  });

  describe("analyzeSource", () => {
    it("should detect language and constructs from TypeScript code", () => {
      const code = `function greet(name: string): void {\n  console.log(name);\n}`;
      const analysis = orchestrator.analyzeSource(code);

      expect(analysis.detectedLanguage).toBe("typescript");
      expect(analysis.detectedConfidence).toBeGreaterThan(0.5);
      expect(analysis.constructs.length).toBeGreaterThan(0);
      expect(analysis.totalConstructs).toBeGreaterThan(0);
    });

    it("should detect Python code", () => {
      const code = `def greet(name):\n    print(f"Hello {name}")`;
      const analysis = orchestrator.analyzeSource(code);

      expect(analysis.detectedLanguage).toBe("python");
    });

    it("should respect language hints", () => {
      const code = `x = 1`;
      const analysis = orchestrator.analyzeSource(code, { languageHint: "python" });

      expect(analysis.detectedLanguage).toBe("python");
    });

    it("should calculate complexity score", () => {
      const code = `
class Server {
  constructor(private port: number) {}
  async start(): Promise<void> {
    if (this.port < 0) throw new Error("bad");
    for (const p of plugins) { await p.init(); }
    try { listen(); } catch (e) { handleError(e); }
  }
}`;
      const analysis = orchestrator.analyzeSource(code);

      expect(analysis.complexityScore).toBeGreaterThan(0);
      expect(analysis.complexityScore).toBeLessThanOrEqual(1);
    });

    it("should detect ambiguous constructs", () => {
      // Interface TS has multiple Python targets
      const code = `interface Config { host: string; port: number; }`;
      const analysis = orchestrator.analyzeSource(code, { targetLanguage: "python" });

      expect(analysis.ambiguousConstructs).toBeDefined();
    });
  });

  describe("prepareTranslation", () => {
    it("should create a job and return a prompt", () => {
      const result = orchestrator.prepareTranslation({
        projectId: "p1",
        sourceCode: "function hello(): string { return 'hi'; }",
        targetLanguage: "python",
        scope: "snippet",
      });

      expect(result.jobId).toBeTruthy();
      expect(result.prompt).toContain("python");
      expect(result.prompt).toContain("function hello");
      expect(result.analysis).toBeDefined();
      expect(result.analysis.detectedLanguage).toBe("typescript");

      // Job should exist in store
      const job = store.getJob(result.jobId);
      expect(job).not.toBeNull();
      expect(job!.status).toBe("analyzing");
    });

    it("should accept explicit source language", () => {
      const result = orchestrator.prepareTranslation({
        projectId: "p1",
        sourceCode: "x = 1",
        sourceLanguage: "python",
        targetLanguage: "typescript",
        scope: "snippet",
      });

      expect(result.analysis.detectedLanguage).toBe("python");
    });
  });

  describe("finalizeTranslation", () => {
    it("should finalize a job with generated code", () => {
      const prep = orchestrator.prepareTranslation({
        projectId: "p1",
        sourceCode: "function greet(name: string): void { console.log(name); }",
        targetLanguage: "python",
        scope: "snippet",
      });

      const result = orchestrator.finalizeTranslation(
        prep.jobId,
        "def greet(name: str) -> None:\n    print(name)",
      );

      expect(result.job.status).toBe("done");
      expect(result.job.targetCode).toBe("def greet(name: str) -> None:\n    print(name)");
      expect(result.job.confidenceScore).toBeGreaterThan(0);
      expect(result.evidence).toBeDefined();
    });

    it("should throw for non-existent job", () => {
      expect(() => orchestrator.finalizeTranslation("nonexistent", "code")).toThrow();
    });

    it("should mark job as failed on empty code", () => {
      const prep = orchestrator.prepareTranslation({
        projectId: "p1",
        sourceCode: "const x = 1;",
        targetLanguage: "python",
        scope: "snippet",
      });

      const result = orchestrator.finalizeTranslation(prep.jobId, "");

      expect(result.job.status).toBe("failed");
    });
  });

  describe("end-to-end", () => {
    it("should handle full analyze → prepare → finalize flow", () => {
      const sourceCode = `
export function calculateSum(items: number[]): number {
  let total = 0;
  for (const item of items) {
    total += item;
  }
  return total;
}`;

      // Step 1: Analyze
      const analysis = orchestrator.analyzeSource(sourceCode);
      expect(analysis.detectedLanguage).toBe("typescript");
      expect(analysis.constructs.length).toBeGreaterThan(0);

      // Step 2: Prepare
      const prep = orchestrator.prepareTranslation({
        projectId: "p1",
        sourceCode,
        targetLanguage: "python",
        scope: "function",
      });
      expect(prep.prompt.length).toBeGreaterThan(100);

      // Step 3: Finalize (simulate AI output)
      const pythonCode = `def calculate_sum(items: list[int]) -> int:\n    total = 0\n    for item in items:\n        total += item\n    return total`;
      const result = orchestrator.finalizeTranslation(prep.jobId, pythonCode);

      expect(result.job.status).toBe("done");
      expect(result.job.targetCode).toContain("calculate_sum");
      expect(result.evidence.confidenceScore).toBeGreaterThan(0);
    });
  });
});
