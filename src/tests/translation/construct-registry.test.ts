import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { runMigrations } from "../../core/store/migrations.js";
import { ConstructRegistry } from "../../core/translation/ucr/construct-registry.js";

describe("ConstructRegistry", () => {
  let db: Database.Database;
  let registry: ConstructRegistry;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    runMigrations(db);
    registry = new ConstructRegistry(db);
  });

  describe("categories", () => {
    it("should insert and get category", () => {
      registry.insertCategory({ id: "control_flow", name: "Control Flow", description: "Branching and loops" });
      const cat = registry.getCategory("control_flow");
      expect(cat).toBeDefined();
      expect(cat?.name).toBe("Control Flow");
    });

    it("should list all categories", () => {
      registry.insertCategory({ id: "control_flow", name: "Control Flow" });
      registry.insertCategory({ id: "functions", name: "Functions" });
      const cats = registry.listCategories();
      expect(cats).toHaveLength(2);
    });
  });

  describe("constructs", () => {
    it("should insert and get construct by canonical name", () => {
      registry.insertCategory({ id: "control_flow", name: "Control Flow" });
      registry.insertConstruct({
        id: "uc_if_else",
        categoryId: "control_flow",
        canonicalName: "if_else",
        description: "Conditional branching",
        semanticGroup: "conditional",
      });

      const construct = registry.getConstruct("if_else");
      expect(construct).toBeDefined();
      expect(construct?.id).toBe("uc_if_else");
      expect(construct?.semanticGroup).toBe("conditional");
    });

    it("should get construct by id", () => {
      registry.insertCategory({ id: "functions", name: "Functions" });
      registry.insertConstruct({ id: "uc_fn_def", categoryId: "functions", canonicalName: "function_definition" });

      const construct = registry.getConstructById("uc_fn_def");
      expect(construct).toBeDefined();
      expect(construct?.canonicalName).toBe("function_definition");
    });

    it("should list constructs by category", () => {
      registry.insertCategory({ id: "control_flow", name: "Control Flow" });
      registry.insertConstruct({ id: "uc_if", categoryId: "control_flow", canonicalName: "if_else" });
      registry.insertConstruct({ id: "uc_for", categoryId: "control_flow", canonicalName: "for_loop" });

      const constructs = registry.getConstructsByCategory("control_flow");
      expect(constructs).toHaveLength(2);
    });

    it("should return null for unknown construct", () => {
      expect(registry.getConstruct("nonexistent")).toBeNull();
    });
  });

  describe("language mappings", () => {
    beforeEach(() => {
      registry.insertCategory({ id: "control_flow", name: "Control Flow" });
      registry.insertConstruct({ id: "uc_if", categoryId: "control_flow", canonicalName: "if_else" });
    });

    it("should insert and get mappings for a construct+language", () => {
      registry.insertMapping({
        id: "map_if_ts",
        constructId: "uc_if",
        languageId: "typescript",
        syntaxPattern: "if ({{condition}}) { {{body}} }",
        confidence: 1.0,
        isPrimary: true,
      });

      const mappings = registry.getMappings("uc_if", "typescript");
      expect(mappings).toHaveLength(1);
      expect(mappings[0].syntaxPattern).toBe("if ({{condition}}) { {{body}} }");
    });

    it("should get primary mapping", () => {
      registry.insertMapping({
        id: "map_if_py_1",
        constructId: "uc_if",
        languageId: "python",
        syntaxPattern: "if {{condition}}:\\n    {{body}}",
        confidence: 1.0,
        isPrimary: true,
      });
      registry.insertMapping({
        id: "map_if_py_2",
        constructId: "uc_if",
        languageId: "python",
        syntaxPattern: "{{body}} if {{condition}} else None",
        confidence: 0.5,
        isPrimary: false,
      });

      const primary = registry.getPrimaryMapping("uc_if", "python");
      expect(primary).toBeDefined();
      expect(primary?.isPrimary).toBe(true);
      expect(primary?.confidence).toBe(1.0);
    });

    it("should return null for unknown mapping", () => {
      expect(registry.getPrimaryMapping("uc_if", "rust")).toBeNull();
    });
  });

  describe("findTranslationPath", () => {
    beforeEach(() => {
      registry.insertCategory({ id: "functions", name: "Functions" });
      registry.insertConstruct({ id: "uc_fn", categoryId: "functions", canonicalName: "function_definition" });
      registry.insertMapping({
        id: "map_fn_ts",
        constructId: "uc_fn",
        languageId: "typescript",
        syntaxPattern: "function {{name}}({{params}}) { {{body}} }",
        confidence: 1.0,
        isPrimary: true,
      });
      registry.insertMapping({
        id: "map_fn_py",
        constructId: "uc_fn",
        languageId: "python",
        syntaxPattern: "def {{name}}({{params}}):\\n    {{body}}",
        confidence: 1.0,
        isPrimary: true,
      });
    });

    it("should return translation path with source + target + confidence", () => {
      const path = registry.findTranslationPath("uc_fn", "typescript", "python");
      expect(path).toBeDefined();
      expect(path?.sourceMapping.languageId).toBe("typescript");
      expect(path?.targetMapping.languageId).toBe("python");
      expect(path?.confidence).toBe(1.0);
    });

    it("should return null when source mapping missing", () => {
      const path = registry.findTranslationPath("uc_fn", "rust", "python");
      expect(path).toBeNull();
    });

    it("should return null when target mapping missing", () => {
      const path = registry.findTranslationPath("uc_fn", "typescript", "rust");
      expect(path).toBeNull();
    });

    it("should include alternatives for target language", () => {
      registry.insertMapping({
        id: "map_fn_py_alt",
        constructId: "uc_fn",
        languageId: "python",
        syntaxPattern: "{{name}} = lambda {{params}}: {{body}}",
        confidence: 0.4,
        isPrimary: false,
      });

      const path = registry.findTranslationPath("uc_fn", "typescript", "python");
      expect(path).toBeDefined();
      expect(path?.alternatives.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("updateConfidence", () => {
    it("should adjust confidence by delta", () => {
      registry.insertCategory({ id: "cf", name: "CF" });
      registry.insertConstruct({ id: "uc_x", categoryId: "cf", canonicalName: "x" });
      registry.insertMapping({
        id: "map_x",
        constructId: "uc_x",
        languageId: "typescript",
        syntaxPattern: "x",
        confidence: 0.8,
        isPrimary: true,
      });

      registry.updateConfidence("map_x", 0.1);
      const updated = registry.getPrimaryMapping("uc_x", "typescript");
      expect(updated?.confidence).toBeCloseTo(0.9, 2);
    });

    it("should clamp confidence to [0, 1]", () => {
      registry.insertCategory({ id: "cf", name: "CF" });
      registry.insertConstruct({ id: "uc_y", categoryId: "cf", canonicalName: "y" });
      registry.insertMapping({
        id: "map_y",
        constructId: "uc_y",
        languageId: "python",
        syntaxPattern: "y",
        confidence: 0.95,
        isPrimary: true,
      });

      registry.updateConfidence("map_y", 0.2);
      const updated = registry.getPrimaryMapping("uc_y", "python");
      expect(updated?.confidence).toBeLessThanOrEqual(1.0);
    });
  });

  describe("seedFromJson", () => {
    it("should seed categories, constructs, and mappings from JSON", () => {
      const count = registry.seedFromJson({
        categories: [{ id: "cf", name: "Control Flow" }],
        constructs: [{ id: "uc_if", categoryId: "cf", canonicalName: "if_else" }],
        mappings: [
          { id: "m1", constructId: "uc_if", languageId: "typescript", syntaxPattern: "if ({{c}}) {}", confidence: 1.0, isPrimary: true },
          { id: "m2", constructId: "uc_if", languageId: "python", syntaxPattern: "if {{c}}:", confidence: 1.0, isPrimary: true },
        ],
      });

      expect(count.categories).toBe(1);
      expect(count.constructs).toBe(1);
      expect(count.mappings).toBe(2);
      expect(registry.getConstruct("if_else")).toBeDefined();
      expect(registry.getPrimaryMapping("uc_if", "python")).toBeDefined();
    });

    it("should be idempotent (re-seed does not duplicate)", () => {
      const data = {
        categories: [{ id: "cf", name: "Control Flow" }],
        constructs: [{ id: "uc_if", categoryId: "cf", canonicalName: "if_else" }],
        mappings: [{ id: "m1", constructId: "uc_if", languageId: "typescript", syntaxPattern: "if ({{c}}) {}", confidence: 1.0, isPrimary: true }],
      };

      registry.seedFromJson(data);
      registry.seedFromJson(data);

      const cats = registry.listCategories();
      expect(cats).toHaveLength(1);
    });
  });
});
