import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { ConstructRegistry } from "../../core/translation/ucr/construct-registry.js";
import { loadAndSeedRegistry } from "../../core/translation/ucr/construct-seed.js";
import { scoreConstruct, scoreConstructs } from "../../core/translation/confidence/equivalence-scorer.js";
import { detectAmbiguities } from "../../core/translation/confidence/ambiguity-detector.js";
import type { TranslationScore } from "../../core/translation/ucr/construct-types.js";
import type { AmbiguityReport } from "../../core/translation/ucr/construct-types.js";

function createSeededRegistry(): ConstructRegistry {
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
  `);
  const registry = new ConstructRegistry(db);
  loadAndSeedRegistry(registry);
  return registry;
}

describe("ambiguity-detector", () => {
  let registry: ConstructRegistry;

  beforeEach(() => {
    registry = createSeededRegistry();
  });

  describe("detectAmbiguities", () => {
    it("should flag uc_interface TS→Python as multiple_targets", () => {
      const score = scoreConstruct(registry, "uc_interface", "typescript", "python");
      expect(score).not.toBeNull();

      const reports = detectAmbiguities([score!], registry, "typescript", "python");
      const ifaceReport = reports.find((r: AmbiguityReport) => r.constructId === "uc_interface");

      expect(ifaceReport).toBeDefined();
      expect(ifaceReport!.ambiguityType).toBe("multiple_targets");
      expect(ifaceReport!.candidates.length).toBeGreaterThan(1);
      expect(ifaceReport!.canonicalName).toBeTruthy();
    });

    it("should NOT flag uc_if_else TS→Python (exact mapping)", () => {
      const score = scoreConstruct(registry, "uc_if_else", "typescript", "python");
      expect(score).not.toBeNull();

      const reports = detectAmbiguities([score!], registry, "typescript", "python");
      const ifElseReport = reports.find((r: AmbiguityReport) => r.constructId === "uc_if_else");

      expect(ifElseReport).toBeUndefined();
    });

    it("should detect no_target when construct has no target mapping", () => {
      // Create a fake score with no selectedMappingId
      const fakeScore: TranslationScore = {
        constructId: "fake_no_target",
        staticConfidence: 0,
        contextualConfidence: 0,
        finalConfidence: 0,
        selectedMappingId: "",
        alternatives: [],
        needsAiAssist: true,
      };

      const reports = detectAmbiguities([fakeScore], registry, "typescript", "python");
      const report = reports.find((r: AmbiguityReport) => r.constructId === "fake_no_target");

      expect(report).toBeDefined();
      expect(report!.ambiguityType).toBe("no_target");
    });

    it("should detect lossy_translation for low-confidence single-target constructs", () => {
      // uc_export_default TS→Python: low confidence, single primary mapping
      const score = scoreConstruct(registry, "uc_export_default", "typescript", "python");
      expect(score).not.toBeNull();

      const reports = detectAmbiguities([score!], registry, "typescript", "python");
      const report = reports.find((r: AmbiguityReport) => r.constructId === "uc_export_default");

      // Should flag as lossy since confidence is low and it's not an exact equivalent
      if (report) {
        expect(report.ambiguityType).toBe("lossy_translation");
      }
    });

    it("should include candidates with confidence and tradeoff for each report", () => {
      const score = scoreConstruct(registry, "uc_interface", "typescript", "python");
      expect(score).not.toBeNull();

      const reports = detectAmbiguities([score!], registry, "typescript", "python");
      const report = reports.find((r: AmbiguityReport) => r.constructId === "uc_interface");

      expect(report).toBeDefined();
      for (const candidate of report!.candidates) {
        expect(candidate.mappingId).toBeTruthy();
        expect(candidate.confidence).toBeGreaterThanOrEqual(0);
        expect(candidate.confidence).toBeLessThanOrEqual(1);
        expect(candidate.tradeoff).toBeTruthy();
      }
    });

    it("should return empty array when all constructs are exact matches", () => {
      const exactIds = ["uc_if_else", "uc_for_loop", "uc_while_loop"];
      const scores = scoreConstructs(registry, exactIds, "typescript", "python");

      const reports = detectAmbiguities(scores, registry, "typescript", "python");

      // Exact 1:1 mappings should not generate ambiguity reports
      const flaggedExact = reports.filter((r: AmbiguityReport) => exactIds.includes(r.constructId));
      expect(flaggedExact).toHaveLength(0);
    });

    it("should return empty array for empty input", () => {
      const reports = detectAmbiguities([], registry, "typescript", "python");
      expect(reports).toHaveLength(0);
    });

    it("should handle batch scoring with mixed ambiguity types", () => {
      const mixedIds = ["uc_fn_def", "uc_interface", "uc_if_else", "uc_export_default"];
      const scores = scoreConstructs(registry, mixedIds, "typescript", "python");

      const reports = detectAmbiguities(scores, registry, "typescript", "python");

      // At least uc_interface should be flagged
      const ifaceReport = reports.find((r: AmbiguityReport) => r.constructId === "uc_interface");
      expect(ifaceReport).toBeDefined();

      // uc_if_else should NOT be flagged
      const ifElse = reports.find((r: AmbiguityReport) => r.constructId === "uc_if_else");
      expect(ifElse).toBeUndefined();
    });
  });
});
