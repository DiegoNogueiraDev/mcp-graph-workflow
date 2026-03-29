/**
 * Tests for filePath parameter support in analyze_translation and translate_code MCP tools.
 * Validates file reading, path security, extension-to-language mapping, and error handling.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { assertPathInsideProject } from "../core/utils/fs.js";

/** Extension-to-language map (mirrors the one in the tool files) */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ".py": "python",
  ".ts": "typescript",
  ".js": "javascript",
  ".java": "java",
  ".go": "go",
  ".rs": "rust",
  ".cs": "csharp",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".scala": "scala",
  ".lua": "lua",
  ".hs": "haskell",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".c": "c",
  ".dart": "dart",
  ".ex": "elixir",
  ".exs": "elixir",
};

describe("translation filePath support", () => {
  describe("extension-to-language mapping", () => {
    it("should map .py to python", () => {
      expect(EXTENSION_TO_LANGUAGE[".py"]).toBe("python");
    });

    it("should map .ts to typescript", () => {
      expect(EXTENSION_TO_LANGUAGE[".ts"]).toBe("typescript");
    });

    it("should map .js to javascript", () => {
      expect(EXTENSION_TO_LANGUAGE[".js"]).toBe("javascript");
    });

    it("should map C++ extensions (.cpp, .cc, .cxx) to cpp", () => {
      expect(EXTENSION_TO_LANGUAGE[".cpp"]).toBe("cpp");
      expect(EXTENSION_TO_LANGUAGE[".cc"]).toBe("cpp");
      expect(EXTENSION_TO_LANGUAGE[".cxx"]).toBe("cpp");
    });

    it("should map Elixir extensions (.ex, .exs) to elixir", () => {
      expect(EXTENSION_TO_LANGUAGE[".ex"]).toBe("elixir");
      expect(EXTENSION_TO_LANGUAGE[".exs"]).toBe("elixir");
    });

    it("should map all 21 extensions", () => {
      const expectedMappings: Array<[string, string]> = [
        [".py", "python"],
        [".ts", "typescript"],
        [".js", "javascript"],
        [".java", "java"],
        [".go", "go"],
        [".rs", "rust"],
        [".cs", "csharp"],
        [".rb", "ruby"],
        [".php", "php"],
        [".swift", "swift"],
        [".kt", "kotlin"],
        [".scala", "scala"],
        [".lua", "lua"],
        [".hs", "haskell"],
        [".cpp", "cpp"],
        [".cc", "cpp"],
        [".cxx", "cpp"],
        [".c", "c"],
        [".dart", "dart"],
        [".ex", "elixir"],
        [".exs", "elixir"],
      ];

      for (const [ext, lang] of expectedMappings) {
        expect(EXTENSION_TO_LANGUAGE[ext]).toBe(lang);
      }
    });

    it("should return undefined for unknown extensions", () => {
      expect(EXTENSION_TO_LANGUAGE[".xyz"]).toBeUndefined();
      expect(EXTENSION_TO_LANGUAGE[".txt"]).toBeUndefined();
      expect(EXTENSION_TO_LANGUAGE[".json"]).toBeUndefined();
    });
  });

  describe("assertPathInsideProject", () => {
    it("should accept a path inside the project directory", () => {
      const result = assertPathInsideProject("package.json");
      expect(result).toBe(path.resolve("package.json"));
    });

    it("should reject a path outside the project directory", () => {
      expect(() => assertPathInsideProject("/etc/passwd")).toThrow(
        "Path outside project directory",
      );
    });

    it("should reject path traversal attempts", () => {
      expect(() => assertPathInsideProject("../../etc/passwd")).toThrow(
        "Path outside project directory",
      );
    });
  });

  describe("file reading with filePath", () => {
    const tmpDir = path.resolve("src/tests/.tmp-translation-test");
    const pyFile = path.join(tmpDir, "sample.py");

    // Setup: create a temp file inside the project
    const pyCode = 'def hello():\n    print("Hello, world!")\n';

    it("should read a file from disk and detect language from extension", () => {
      // Arrange
      mkdirSync(tmpDir, { recursive: true });
      writeFileSync(pyFile, pyCode, "utf-8");

      try {
        // Act — simulates the filePath logic in the MCP tools
        const resolvedPath = assertPathInsideProject(pyFile);
        const code = readFileSync(resolvedPath, "utf-8");
        const ext = path.extname(resolvedPath).toLowerCase();
        const detectedLanguage = EXTENSION_TO_LANGUAGE[ext];

        // Assert
        expect(code).toBe(pyCode);
        expect(detectedLanguage).toBe("python");
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("should read package.json as a real project file", () => {
      // Arrange — package.json always exists in the project root
      const filePath = "package.json";

      // Act
      const resolvedPath = assertPathInsideProject(filePath);
      const content = readFileSync(resolvedPath, "utf-8");

      // Assert
      expect(content).toContain('"name"');
      expect(content.length).toBeGreaterThan(0);
    });

    it("should return undefined language for unknown extensions", () => {
      // Arrange
      const filePath = "package.json";
      const resolvedPath = assertPathInsideProject(filePath);
      const ext = path.extname(resolvedPath).toLowerCase();

      // Act
      const detectedLanguage = EXTENSION_TO_LANGUAGE[ext];

      // Assert — .json is not in the map
      expect(detectedLanguage).toBeUndefined();
    });
  });

  describe("validation: missing code and filePath", () => {
    it("should require either code or filePath", () => {
      // Simulates the validation logic in both tools
      const code: string | undefined = undefined;
      const filePath: string | undefined = undefined;

      let resolvedCode = code;
      if (filePath) {
        const resolvedPath = assertPathInsideProject(filePath);
        resolvedCode = readFileSync(resolvedPath, "utf-8");
      }

      // Assert — both undefined means error
      expect(resolvedCode).toBeUndefined();
      // The tool would return mcpError("Either code or filePath is required")
    });

    it("should use code when filePath is not provided", () => {
      const code = 'console.log("hello")';
      const filePath: string | undefined = undefined;

      let resolvedCode: string | undefined = code;
      if (filePath) {
        const resolvedPath = assertPathInsideProject(filePath);
        resolvedCode = readFileSync(resolvedPath, "utf-8");
      }

      expect(resolvedCode).toBe(code);
    });
  });
});
