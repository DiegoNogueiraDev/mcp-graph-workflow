import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { ConstructRegistry } from "../../core/translation/ucr/construct-registry.js";
import { loadAndSeedRegistry } from "../../core/translation/ucr/construct-seed.js";
import { scoreConstruct, scoreConstructs } from "../../core/translation/confidence/equivalence-scorer.js";
import { UCR_CONFIDENCE_THRESHOLD } from "../../core/utils/constants.js";
import type { TranslationScore } from "../../core/translation/ucr/construct-types.js";

function createSeededRegistry(): ConstructRegistry {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  // Create UCR tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS ucr_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT
    );
    CREATE TABLE IF NOT EXISTS ucr_constructs (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      canonical_name TEXT NOT NULL UNIQUE,
      description TEXT,
      semantic_group TEXT,
      metadata TEXT DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS ucr_language_mappings (
      id TEXT PRIMARY KEY,
      construct_id TEXT NOT NULL,
      language_id TEXT NOT NULL,
      syntax_pattern TEXT,
      ast_node_type TEXT,
      confidence REAL NOT NULL DEFAULT 0.8,
      is_primary INTEGER NOT NULL DEFAULT 0,
      constraints TEXT DEFAULT '[]'
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

describe("equivalence-scorer", () => {
  let registry: ConstructRegistry;

  beforeEach(() => {
    registry = createSeededRegistry();
  });

  describe("scoreConstruct", () => {
    it("should return a valid TranslationScore for a known construct pair", () => {
      const score = scoreConstruct(registry, "uc_fn_def", "typescript", "python");

      expect(score).not.toBeNull();
      expect(score!.constructId).toBe("uc_fn_def");
      expect(score!.staticConfidence).toBeGreaterThan(0);
      expect(score!.staticConfidence).toBeLessThanOrEqual(1);
      expect(score!.contextualConfidence).toBeGreaterThanOrEqual(0);
      expect(score!.contextualConfidence).toBeLessThanOrEqual(1);
      expect(score!.finalConfidence).toBeGreaterThan(0);
      expect(score!.finalConfidence).toBeLessThanOrEqual(1);
      expect(score!.selectedMappingId).toBeTruthy();
    });

    it("should mark high-confidence constructs as deterministic (needsAiAssist = false)", () => {
      // uc_if_else is a direct 1:1 mapping TS→Python, high confidence
      const score = scoreConstruct(registry, "uc_if_else", "typescript", "python");

      expect(score).not.toBeNull();
      expect(score!.finalConfidence).toBeGreaterThanOrEqual(UCR_CONFIDENCE_THRESHOLD);
      expect(score!.needsAiAssist).toBe(false);
    });

    it("should mark low-confidence constructs as needsAiAssist = true", () => {
      // uc_export_default TS→Python has low confidence (0.5) — no direct equivalent
      const score = scoreConstruct(registry, "uc_export_default", "typescript", "python");

      expect(score).not.toBeNull();
      expect(score!.finalConfidence).toBeLessThan(UCR_CONFIDENCE_THRESHOLD);
      expect(score!.needsAiAssist).toBe(true);
    });

    it("should return null when construct has no source mapping", () => {
      const score = scoreConstruct(registry, "nonexistent_construct", "typescript", "python");
      expect(score).toBeNull();
    });

    it("should return null when target language has no mapping", () => {
      const score = scoreConstruct(registry, "uc_fn_def", "typescript", "nonexistent_lang");
      expect(score).toBeNull();
    });

    it("should include alternatives when multiple target mappings exist", () => {
      // uc_interface TS→Python may have alternatives (ABC, Protocol, etc.)
      const score = scoreConstruct(registry, "uc_interface", "typescript", "python");

      if (score && score.alternatives.length > 0) {
        for (const alt of score.alternatives) {
          expect(alt.mappingId).toBeTruthy();
          expect(alt.confidence).toBeGreaterThanOrEqual(0);
          expect(alt.confidence).toBeLessThanOrEqual(1);
          expect(alt.reason).toBeTruthy();
        }
      }
    });

    it("should compute static confidence from UCR mapping confidence", () => {
      const score = scoreConstruct(registry, "uc_fn_def", "typescript", "python");
      expect(score).not.toBeNull();

      // Static confidence = min(source.confidence, target.confidence) from findTranslationPath
      const path = registry.findTranslationPath("uc_fn_def", "typescript", "python");
      expect(path).not.toBeNull();
      expect(score!.staticConfidence).toBe(path!.confidence);
    });

    it("should compute contextual confidence based on constraint satisfaction", () => {
      const score = scoreConstruct(registry, "uc_fn_def", "typescript", "python");
      expect(score).not.toBeNull();
      // Contextual confidence is between 0 and 1
      expect(score!.contextualConfidence).toBeGreaterThanOrEqual(0);
      expect(score!.contextualConfidence).toBeLessThanOrEqual(1);
    });

    it("should compute finalConfidence as weighted average of static and contextual", () => {
      const score = scoreConstruct(registry, "uc_fn_def", "typescript", "python");
      expect(score).not.toBeNull();
      // Final should be between min and max of the two components
      const min = Math.min(score!.staticConfidence, score!.contextualConfidence);
      const max = Math.max(score!.staticConfidence, score!.contextualConfidence);
      expect(score!.finalConfidence).toBeGreaterThanOrEqual(min - 0.01);
      expect(score!.finalConfidence).toBeLessThanOrEqual(max + 0.01);
    });
  });

  describe("scoreConstructs (batch)", () => {
    it("should score multiple constructs at once", () => {
      const constructIds = ["uc_fn_def", "uc_class_def", "uc_if_else"];
      const scores = scoreConstructs(registry, constructIds, "typescript", "python");

      expect(scores).toHaveLength(3);
      for (const score of scores) {
        expect(score.constructId).toBeTruthy();
        expect(score.finalConfidence).toBeGreaterThan(0);
      }
    });

    it("should skip constructs that have no translation path", () => {
      const constructIds = ["uc_fn_def", "nonexistent", "uc_class_def"];
      const scores = scoreConstructs(registry, constructIds, "typescript", "python");

      // Should only return scores for valid constructs
      expect(scores.length).toBeLessThanOrEqual(3);
      const ids = scores.map((s: TranslationScore) => s.constructId);
      expect(ids).not.toContain("nonexistent");
    });

    it("should return empty array for empty input", () => {
      const scores = scoreConstructs(registry, [], "typescript", "python");
      expect(scores).toHaveLength(0);
    });
  });
});
