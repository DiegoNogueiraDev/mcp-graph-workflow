import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { ConstructRegistry } from "../../core/translation/ucr/construct-registry.js";
import { loadAndSeedRegistry } from "../../core/translation/ucr/construct-seed.js";
import { TsGenerator } from "../../core/translation/generators/ts-generator.js";
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

describe("TsGenerator", () => {
  let registry: ConstructRegistry;
  let generator: TsGenerator;

  beforeEach(() => {
    registry = createSeededRegistry();
    generator = new TsGenerator(registry);
  });

  it("should have languageId = typescript", () => {
    expect(generator.languageId).toBe("typescript");
  });

  describe("generate", () => {
    it("should generate code for a function construct", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "greet", startLine: 1, endLine: 1 },
      ];
      const result = generator.generate(constructs);

      expect(result.code).toContain("function");
      expect(result.code).toContain("greet");
      expect(result.mappedConstructs).toHaveLength(1);
    });

    it("should generate code for a class construct", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_class_def", name: "User", startLine: 1, endLine: 1 },
      ];
      const result = generator.generate(constructs);

      expect(result.code).toContain("class");
      expect(result.code).toContain("User");
    });

    it("should generate code for an interface construct", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_interface", name: "Config", startLine: 1, endLine: 1 },
      ];
      const result = generator.generate(constructs);

      expect(result.code).toContain("interface");
      expect(result.code).toContain("Config");
    });

    it("should generate code for multiple constructs", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "foo", startLine: 1, endLine: 1 },
        { constructId: "uc_class_def", name: "Bar", startLine: 2, endLine: 2 },
      ];
      const result = generator.generate(constructs);

      expect(result.code).toContain("foo");
      expect(result.code).toContain("Bar");
      expect(result.mappedConstructs).toHaveLength(2);
    });

    it("should track unmapped constructs", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "test", startLine: 1, endLine: 1 },
        { constructId: "nonexistent_construct", startLine: 2, endLine: 2 },
      ];
      const result = generator.generate(constructs);

      expect(result.unmappedConstructs).toContain("nonexistent_construct");
    });

    it("should return empty code for empty input", () => {
      const result = generator.generate([]);
      expect(result.code).toBe("");
      expect(result.mappedConstructs).toHaveLength(0);
    });

    it("should use syntaxPattern from UCR for code generation", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_if_else", startLine: 1, endLine: 1 },
      ];
      const result = generator.generate(constructs);

      // Should use the UCR syntax pattern for if/else
      expect(result.code).toContain("if");
      expect(result.mappedConstructs).toHaveLength(1);
    });

    it("should substitute {{name}} placeholder in syntaxPattern", () => {
      const constructs: ParsedConstruct[] = [
        { constructId: "uc_fn_def", name: "calculate", startLine: 1, endLine: 1 },
      ];
      const result = generator.generate(constructs);

      expect(result.code).toContain("calculate");
    });
  });
});
