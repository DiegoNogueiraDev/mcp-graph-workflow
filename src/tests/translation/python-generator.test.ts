import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { ConstructRegistry } from "../../core/translation/ucr/construct-registry.js";
import { loadAndSeedRegistry } from "../../core/translation/ucr/construct-seed.js";
import { PythonGenerator } from "../../core/translation/generators/python-generator.js";
import type { ParsedConstruct } from "../../core/translation/parsers/parser-adapter.js";

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

describe("PythonGenerator", () => {
  let registry: ConstructRegistry;
  let generator: PythonGenerator;

  beforeEach(() => {
    registry = createSeededRegistry();
    generator = new PythonGenerator(registry);
  });

  it("should have languageId = python", () => {
    expect(generator.languageId).toBe("python");
  });

  describe("generate", () => {
    it("should generate code for a function construct", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "greet", startLine: 1, endLine: 1 },
      ];
      const result = generator.generate(constructs);

      expect(result.code).toContain("def");
      expect(result.code).toContain("greet");
      expect(result.mappedConstructs).toHaveLength(1);
    });

    it("should generate snake_case names from camelCase", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "getUserName", startLine: 1, endLine: 1 },
      ];
      const result = generator.generate(constructs);

      expect(result.code).toContain("get_user_name");
    });

    it("should generate code for a class construct", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_class_def", name: "UserService", startLine: 1, endLine: 1 },
      ];
      const result = generator.generate(constructs);

      expect(result.code).toContain("class");
      expect(result.code).toContain("UserService"); // PascalCase kept for classes
    });

    it("should generate code for if/else construct", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_if_else", startLine: 1, endLine: 1 },
      ];
      const result = generator.generate(constructs);

      expect(result.code).toContain("if");
      expect(result.mappedConstructs).toHaveLength(1);
    });

    it("should generate code for multiple constructs", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "process", startLine: 1, endLine: 1 },
        { constructId: "uc_class_def", name: "Handler", startLine: 2, endLine: 2 },
      ];
      const result = generator.generate(constructs);

      expect(result.code).toContain("process");
      expect(result.code).toContain("Handler");
      expect(result.mappedConstructs).toHaveLength(2);
    });

    it("should track unmapped constructs", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "test", startLine: 1, endLine: 1 },
        { constructId: "nonexistent", startLine: 2, endLine: 2 },
      ];
      const result = generator.generate(constructs);

      expect(result.unmappedConstructs).toContain("nonexistent");
    });

    it("should return empty code for empty input", () => {
      const result = generator.generate([]);
      expect(result.code).toBe("");
      expect(result.mappedConstructs).toHaveLength(0);
    });

    it("should generate for loop (Python style)", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_for_each", startLine: 1, endLine: 1 },
      ];
      const result = generator.generate(constructs);

      expect(result.code).toContain("for");
      expect(result.code).toContain("in");
    });

    it("should generate try/except (Python style)", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_try_catch", startLine: 1, endLine: 1 },
      ];
      const result = generator.generate(constructs);

      expect(result.code).toContain("try");
      expect(result.code).toContain("except");
    });
  });
});
