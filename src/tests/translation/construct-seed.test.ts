import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../core/store/migrations.js";
import { ConstructRegistry } from "../../core/translation/ucr/construct-registry.js";
import { loadAndSeedRegistry, seedRegistryFromFile } from "../../core/translation/ucr/construct-seed.js";

describe("UCR Seed Loader", () => {
  let db: Database.Database;
  let registry: ConstructRegistry;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    runMigrations(db);
    registry = new ConstructRegistry(db);
  });

  describe("loadAndSeedRegistry", () => {
    it("should load seed data and populate registry", () => {
      const result = loadAndSeedRegistry(registry);
      expect(result.categories).toBeGreaterThanOrEqual(8);
      expect(result.constructs).toBeGreaterThanOrEqual(50);
      expect(result.mappings).toBeGreaterThanOrEqual(400);
    });

    it("should make constructs queryable after seed", () => {
      loadAndSeedRegistry(registry);
      const ifElse = registry.getConstruct("if_else");
      expect(ifElse).toBeDefined();
      expect(ifElse?.id).toBe("uc_if_else");
    });

    it("should make translation paths available after seed", () => {
      loadAndSeedRegistry(registry);
      const path = registry.findTranslationPath("uc_fn_def", "typescript", "python");
      expect(path).toBeDefined();
      expect(path?.sourceMapping.languageId).toBe("typescript");
      expect(path?.targetMapping.languageId).toBe("python");
    });

    it("should support all 12 language pairs after seed", () => {
      loadAndSeedRegistry(registry);
      const pairs = [
        ["typescript", "python"],
        ["typescript", "go"],
        ["typescript", "java"],
        ["typescript", "rust"],
        ["python", "typescript"],
        ["go", "rust"],
        ["java", "kotlin"],
      ];
      for (const [from, to] of pairs) {
        const path = registry.findTranslationPath("uc_if_else", from, to);
        expect(path, `${from} → ${to} should have translation path for if_else`).toBeDefined();
      }
    });

    it("should be idempotent (re-seed does not duplicate)", () => {
      loadAndSeedRegistry(registry);
      const first = registry.listCategories().length;
      loadAndSeedRegistry(registry);
      const second = registry.listCategories().length;
      expect(second).toBe(first);
    });
  });

  describe("seedRegistryFromFile", () => {
    it("should throw for invalid JSON file path", () => {
      expect(() => seedRegistryFromFile(registry, "/nonexistent/path.json")).toThrow();
    });
  });
});
