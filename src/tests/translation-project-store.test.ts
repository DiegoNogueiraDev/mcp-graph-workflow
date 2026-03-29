import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import AdmZip from "adm-zip";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runMigrations, configureDb } from "../core/store/migrations.js";
import { TranslationProjectStore } from "../core/translation/translation-project-store.js";
import {
  extractZip,
  detectLanguageByExtension,
} from "../core/translation/zip-extractor.js";

// ---------------------------------------------------------------------------
// Test 1: TranslationProjectStore CRUD
// ---------------------------------------------------------------------------

describe("TranslationProjectStore", () => {
  let db: Database.Database;
  let store: TranslationProjectStore;

  beforeEach(() => {
    db = new Database(":memory:");
    configureDb(db);
    runMigrations(db);
    store = new TranslationProjectStore(db);
  });

  afterEach(() => {
    db.close();
  });

  it("should create a project", () => {
    // Arrange
    const input = {
      projectId: "proj-1",
      name: "My Translation",
      targetLanguage: "python",
      totalFiles: 5,
    };

    // Act
    const project = store.createProject(input);

    // Assert
    expect(project.id).toBeDefined();
    expect(project.name).toBe("My Translation");
    expect(project.status).toBe("uploading");
    expect(project.totalFiles).toBe(5);
    expect(project.processedFiles).toBe(0);
  });

  it("should get a project by id", () => {
    // Arrange
    const created = store.createProject({
      projectId: "proj-1",
      name: "Test Project",
      targetLanguage: "typescript",
      sourceLanguage: "python",
      totalFiles: 3,
    });

    // Act
    const fetched = store.getProject(created.id);

    // Assert
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
    expect(fetched!.name).toBe("Test Project");
    expect(fetched!.targetLanguage).toBe("typescript");
    expect(fetched!.sourceLanguage).toBe("python");
    expect(fetched!.totalFiles).toBe(3);
    expect(fetched!.createdAt).toBeDefined();
    expect(fetched!.updatedAt).toBeDefined();
  });

  it("should return null for non-existent project", () => {
    // Arrange — nothing

    // Act
    const result = store.getProject("nonexistent");

    // Assert
    expect(result).toBeNull();
  });

  it("should list projects by projectId", () => {
    // Arrange
    store.createProject({ projectId: "proj-A", name: "A1", targetLanguage: "python" });
    store.createProject({ projectId: "proj-A", name: "A2", targetLanguage: "python" });
    store.createProject({ projectId: "proj-B", name: "B1", targetLanguage: "go" });

    // Act
    const listA = store.listProjects("proj-A");
    const listB = store.listProjects("proj-B");

    // Assert
    expect(listA).toHaveLength(2);
    expect(listB).toHaveLength(1);
  });

  it("should update a project", () => {
    // Arrange
    const created = store.createProject({
      projectId: "proj-1",
      name: "Original",
      targetLanguage: "python",
    });

    // Act
    const updated = store.updateProject(created.id, {
      status: "analyzing",
      processedFiles: 3,
    });

    // Assert
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("analyzing");
    expect(updated!.processedFiles).toBe(3);
    expect(updated!.name).toBe("Original");
  });

  it("should delete a project", () => {
    // Arrange
    const created = store.createProject({
      projectId: "proj-1",
      name: "To Delete",
      targetLanguage: "python",
    });

    // Act
    const deleted = store.deleteProject(created.id);
    const fetched = store.getProject(created.id);

    // Assert
    expect(deleted).toBe(true);
    expect(fetched).toBeNull();
  });

  it("should add a file to project", () => {
    // Arrange
    const project = store.createProject({
      projectId: "proj-1",
      name: "With Files",
      targetLanguage: "python",
    });

    // Act
    const file = store.addFile({
      translationProjectId: project.id,
      filePath: "src/main.ts",
      sourceCode: "const x = 1;",
      sourceLanguage: "typescript",
    });

    // Assert
    expect(file.id).toBeDefined();
    expect(file.translationProjectId).toBe(project.id);
    expect(file.filePath).toBe("src/main.ts");
    expect(file.sourceCode).toBe("const x = 1;");
    expect(file.status).toBe("pending");
  });

  it("should get files for a project", () => {
    // Arrange
    const project = store.createProject({
      projectId: "proj-1",
      name: "Multi Files",
      targetLanguage: "python",
    });
    store.addFile({ translationProjectId: project.id, filePath: "a.ts", sourceCode: "a" });
    store.addFile({ translationProjectId: project.id, filePath: "b.ts", sourceCode: "b" });
    store.addFile({ translationProjectId: project.id, filePath: "c.ts", sourceCode: "c" });

    // Act
    const files = store.getFiles(project.id);

    // Assert
    expect(files).toHaveLength(3);
  });

  it("should update a file", () => {
    // Arrange
    const project = store.createProject({
      projectId: "proj-1",
      name: "Update File",
      targetLanguage: "python",
    });
    const file = store.addFile({
      translationProjectId: project.id,
      filePath: "main.ts",
      sourceCode: "const x = 1;",
    });

    // Act
    const updated = store.updateFile(file.id, {
      status: "analyzed",
      confidenceScore: 0.95,
    });

    // Assert
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("analyzed");
    expect(updated!.confidenceScore).toBe(0.95);
  });

  it("should compute project confidence as weighted average by LOC", () => {
    // Arrange
    const project = store.createProject({
      projectId: "proj-1",
      name: "Confidence Test",
      targetLanguage: "python",
    });

    const file1 = store.addFile({
      translationProjectId: project.id,
      filePath: "small.ts",
      sourceCode: "line1\nline2", // 2 lines
    });
    store.updateFile(file1.id, { confidenceScore: 0.8 });

    const file2 = store.addFile({
      translationProjectId: project.id,
      filePath: "large.ts",
      sourceCode: "a\nb\nc\nd", // 4 lines
    });
    store.updateFile(file2.id, { confidenceScore: 0.5 });

    // Act
    const result = store.computeProjectConfidence(project.id);

    // Assert — weighted avg: (0.8*2 + 0.5*4) / (2+4) = 3.6/6 = 0.6
    expect(result.overallConfidence).toBe(0.6);
  });
});

// ---------------------------------------------------------------------------
// Test 2: ZIP Extractor
// ---------------------------------------------------------------------------

describe("zip-extractor", () => {
  const tempFiles: string[] = [];

  function createTestZip(files: Record<string, string>): string {
    const zip = new AdmZip();
    for (const [name, content] of Object.entries(files)) {
      zip.addFile(name, Buffer.from(content, "utf-8"));
    }
    const zipPath = path.join(tmpdir(), `test-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`);
    zip.writeZip(zipPath);
    tempFiles.push(zipPath);
    return zipPath;
  }

  afterEach(() => {
    for (const f of tempFiles) {
      try { rmSync(f); } catch { /* ignore */ }
    }
    tempFiles.length = 0;
  });

  describe("detectLanguageByExtension", () => {
    it("should detect language by extension", () => {
      // Arrange — known extensions

      // Act & Assert
      expect(detectLanguageByExtension(".py")).toBe("python");
      expect(detectLanguageByExtension(".ts")).toBe("typescript");
      expect(detectLanguageByExtension(".java")).toBe("java");
      expect(detectLanguageByExtension(".go")).toBe("go");
      expect(detectLanguageByExtension(".rs")).toBe("rust");
    });

    it("should return undefined for unsupported extensions", () => {
      // Arrange — unsupported extensions

      // Act & Assert
      expect(detectLanguageByExtension(".txt")).toBeUndefined();
      expect(detectLanguageByExtension(".md")).toBeUndefined();
      expect(detectLanguageByExtension(".json")).toBeUndefined();
      expect(detectLanguageByExtension(".unknown")).toBeUndefined();
    });
  });

  describe("extractZip", () => {
    it("should extract files from a valid zip", () => {
      // Arrange
      const zipPath = createTestZip({
        "main.py": "print('hello')",
        "utils.py": "def add(a, b): return a + b",
      });

      // Act
      const results = extractZip(zipPath);

      // Assert
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.relativePath).sort()).toEqual(["main.py", "utils.py"]);
      expect(results.find((r) => r.relativePath === "main.py")!.content).toBe("print('hello')");
    });

    it("should filter out node_modules", () => {
      // Arrange
      const zipPath = createTestZip({
        "node_modules/foo.js": "module.exports = {}",
      });

      // Act
      const results = extractZip(zipPath);

      // Assert
      expect(results).toHaveLength(0);
    });

    it("should filter out hidden files", () => {
      // Arrange
      const zipPath = createTestZip({
        ".hidden.py": "secret = True",
      });

      // Act
      const results = extractZip(zipPath);

      // Assert
      expect(results).toHaveLength(0);
    });

    it("should filter out binary files", () => {
      // Arrange
      const zipPath = createTestZip({
        "image.png": "\x89PNG\r\n\x1a\n",
      });

      // Act
      const results = extractZip(zipPath);

      // Assert
      expect(results).toHaveLength(0);
    });

    it("should detect language for extracted files", () => {
      // Arrange
      const zipPath = createTestZip({
        "app.ts": "const x = 1;",
        "lib.py": "x = 1",
        "readme.txt": "Hello",
      });

      // Act
      const results = extractZip(zipPath);

      // Assert
      const tsFile = results.find((r) => r.relativePath === "app.ts");
      const pyFile = results.find((r) => r.relativePath === "lib.py");
      const txtFile = results.find((r) => r.relativePath === "readme.txt");

      expect(tsFile!.detectedLanguage).toBe("typescript");
      expect(pyFile!.detectedLanguage).toBe("python");
      expect(txtFile!.detectedLanguage).toBeUndefined();
    });
  });
});
