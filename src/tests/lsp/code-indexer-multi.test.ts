import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import path from "node:path";
import { CodeStore } from "../../core/code/code-store.js";
import { CodeIndexer } from "../../core/code/code-indexer.js";
import { configureDb, runMigrations } from "../../core/store/migrations.js";
import type { AnalyzedFile, CodeAnalyzer } from "../../core/code/code-types.js";

// ── Fake analyzer for testing multi-language routing ──

class FakePythonAnalyzer implements CodeAnalyzer {
  readonly languages = ["python"];
  readonly extensions = [".py", ".pyi"];

  async analyzeFile(filePath: string, basePath: string): Promise<AnalyzedFile> {
    const relative = path.relative(basePath, filePath);
    return {
      file: relative,
      symbols: [
        {
          name: "fake_function",
          kind: "function",
          file: relative,
          startLine: 1,
          endLine: 10,
          exported: true,
        },
      ],
      relations: [],
    };
  }
}

class FakeRustAnalyzer implements CodeAnalyzer {
  readonly languages = ["rust"];
  readonly extensions = [".rs"];

  async analyzeFile(filePath: string, basePath: string): Promise<AnalyzedFile> {
    const relative = path.relative(basePath, filePath);
    return {
      file: relative,
      symbols: [
        {
          name: "fake_struct",
          kind: "class",
          file: relative,
          startLine: 1,
          endLine: 5,
          exported: true,
        },
        {
          name: "fake_impl",
          kind: "method",
          file: relative,
          startLine: 7,
          endLine: 12,
          exported: false,
        },
      ],
      relations: [],
    };
  }
}

describe("CodeIndexer — multi-language support", () => {
  let db: Database.Database;
  let store: CodeStore;
  const projectId = "proj_multi";

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new CodeStore(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("constructor backward compatibility", () => {
    it("should use TsAnalyzer by default when no analyzers provided", () => {
      // Arrange & Act
      const indexer = new CodeIndexer(store, projectId);

      // Assert — indexer exists and can be used (no throw)
      expect(indexer).toBeDefined();
    });

    it("should accept custom analyzers array", () => {
      // Arrange & Act
      const indexer = new CodeIndexer(store, projectId, [new FakePythonAnalyzer()]);

      // Assert
      expect(indexer).toBeDefined();
    });
  });

  describe("extension routing", () => {
    it("should route .py files to the Python analyzer", async () => {
      // Arrange
      const pyAnalyzer = new FakePythonAnalyzer();
      const indexer = new CodeIndexer(store, projectId, [pyAnalyzer]);
      const basePath = "/fake/project";

      // Act — indexFiles with a .py file path (FakePythonAnalyzer returns fake data)
      const result = await indexer.indexFiles(
        ["/fake/project/app.py"],
        basePath,
      );

      // Assert
      expect(result.fileCount).toBe(1);
      expect(result.symbolCount).toBe(1);

      const symbols = store.findSymbolsByName("fake_function", projectId);
      expect(symbols.length).toBe(1);
      expect(symbols[0].kind).toBe("function");
    });

    it("should route .rs files to the Rust analyzer", async () => {
      // Arrange
      const rustAnalyzer = new FakeRustAnalyzer();
      const indexer = new CodeIndexer(store, projectId, [rustAnalyzer]);
      const basePath = "/fake/project";

      // Act
      const result = await indexer.indexFiles(
        ["/fake/project/src/main.rs"],
        basePath,
      );

      // Assert
      expect(result.fileCount).toBe(1);
      expect(result.symbolCount).toBe(2);

      const structs = store.findSymbolsByName("fake_struct", projectId);
      expect(structs.length).toBe(1);
    });

    it("should skip files with unsupported extensions", async () => {
      // Arrange — only Python analyzer, no TS
      const indexer = new CodeIndexer(store, projectId, [new FakePythonAnalyzer()]);
      const basePath = "/fake/project";

      // Act — pass a .ts file, which FakePythonAnalyzer does not handle
      const result = await indexer.indexFiles(
        ["/fake/project/index.ts"],
        basePath,
      );

      // Assert
      expect(result.fileCount).toBe(0);
      expect(result.symbolCount).toBe(0);
    });

    it("should handle multiple analyzers simultaneously", async () => {
      // Arrange
      const indexer = new CodeIndexer(store, projectId, [
        new FakePythonAnalyzer(),
        new FakeRustAnalyzer(),
      ]);
      const basePath = "/fake/project";

      // Act
      const result = await indexer.indexFiles(
        [
          "/fake/project/app.py",
          "/fake/project/lib.rs",
        ],
        basePath,
      );

      // Assert
      expect(result.fileCount).toBe(2);
      expect(result.symbolCount).toBe(3); // 1 from Python + 2 from Rust
    });
  });

  describe("languageStatus in IndexResult", () => {
    it("should include languageStatus in the result", async () => {
      // Arrange
      const indexer = new CodeIndexer(store, projectId, [
        new FakePythonAnalyzer(),
        new FakeRustAnalyzer(),
      ]);
      const basePath = "/fake/project";

      // Act
      const result = await indexer.indexFiles(
        ["/fake/project/app.py", "/fake/project/main.rs"],
        basePath,
      );

      // Assert
      expect(result.languageStatus).toBeDefined();
      expect(result.languageStatus!["python"]).toBeDefined();
      expect(result.languageStatus!["python"].fileCount).toBe(1);
      expect(result.languageStatus!["python"].symbolCount).toBe(1);
      expect(result.languageStatus!["rust"]).toBeDefined();
      expect(result.languageStatus!["rust"].fileCount).toBe(1);
      expect(result.languageStatus!["rust"].symbolCount).toBe(2);
    });

    it("should report available=true for non-TS analyzers", async () => {
      // Arrange
      const indexer = new CodeIndexer(store, projectId, [new FakePythonAnalyzer()]);
      const basePath = "/fake/project";

      // Act
      const result = await indexer.indexFiles([], basePath);

      // Assert
      expect(result.languageStatus).toBeDefined();
      expect(result.languageStatus!["python"].available).toBe(true);
    });
  });

  describe("backward compat — TS-only indexing", () => {
    it("should return typescriptAvailable field in IndexResult", async () => {
      // Arrange — default TsAnalyzer
      const indexer = new CodeIndexer(store, projectId);

      // Act
      const result = await indexer.indexFiles([], "/fake");

      // Assert — typescriptAvailable should be a boolean
      expect(typeof result.typescriptAvailable).toBe("boolean");
    });

    it("should index real TS files with default constructor", async () => {
      // Arrange — use project's own utils as fixture
      const indexer = new CodeIndexer(store, projectId);
      const fixtureDir = path.resolve(import.meta.dirname, "..", "..", "core", "utils");

      // Act
      const result = await indexer.indexDirectory(fixtureDir, fixtureDir);

      // Assert — should find at least some TS files
      if (result.typescriptAvailable) {
        expect(result.fileCount).toBeGreaterThan(0);
        expect(result.symbolCount).toBeGreaterThan(0);
      }
      // If TS not available (CI env), at least no crash
      expect(result).toBeDefined();
    });
  });
});
