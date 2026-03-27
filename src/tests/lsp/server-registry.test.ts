/**
 * TDD Red — Tests for ServerRegistry class.
 * Validates server registration, extension routing, overrides, and lookups.
 */

import { describe, it, expect } from "vitest";
import { ServerRegistry } from "../../core/lsp/server-registry.js";

describe("ServerRegistry", () => {
  describe("default servers", () => {
    it("should have 12 built-in language servers", () => {
      const registry = new ServerRegistry();
      const configs = registry.getAllConfigs();

      expect(configs).toHaveLength(12);

      const languageIds = configs.map((c) => c.languageId).sort();
      expect(languageIds).toEqual([
        "cpp",
        "csharp",
        "go",
        "java",
        "kotlin",
        "lua",
        "php",
        "python",
        "ruby",
        "rust",
        "swift",
        "typescript",
      ]);
    });
  });

  describe("extension routing", () => {
    it("should route .ts to typescript", () => {
      const registry = new ServerRegistry();
      expect(registry.getLanguageForExtension("ts")).toBe("typescript");
    });

    it("should route .py to python", () => {
      const registry = new ServerRegistry();
      expect(registry.getLanguageForExtension("py")).toBe("python");
    });

    it("should route .rs to rust", () => {
      const registry = new ServerRegistry();
      expect(registry.getLanguageForExtension("rs")).toBe("rust");
    });

    it("should route .go to go", () => {
      const registry = new ServerRegistry();
      expect(registry.getLanguageForExtension("go")).toBe("go");
    });

    it("should route .java to java", () => {
      const registry = new ServerRegistry();
      expect(registry.getLanguageForExtension("java")).toBe("java");
    });

    it("should route .cpp, .c, and .h to cpp", () => {
      const registry = new ServerRegistry();
      expect(registry.getLanguageForExtension("cpp")).toBe("cpp");
      expect(registry.getLanguageForExtension("c")).toBe("cpp");
      expect(registry.getLanguageForExtension("h")).toBe("cpp");
    });

    it("should route .rb to ruby", () => {
      const registry = new ServerRegistry();
      expect(registry.getLanguageForExtension("rb")).toBe("ruby");
    });

    it("should route .php to php", () => {
      const registry = new ServerRegistry();
      expect(registry.getLanguageForExtension("php")).toBe("php");
    });

    it("should route .kt to kotlin", () => {
      const registry = new ServerRegistry();
      expect(registry.getLanguageForExtension("kt")).toBe("kotlin");
    });

    it("should route .swift to swift", () => {
      const registry = new ServerRegistry();
      expect(registry.getLanguageForExtension("swift")).toBe("swift");
    });

    it("should route .cs to csharp", () => {
      const registry = new ServerRegistry();
      expect(registry.getLanguageForExtension("cs")).toBe("csharp");
    });

    it("should route .lua to lua", () => {
      const registry = new ServerRegistry();
      expect(registry.getLanguageForExtension("lua")).toBe("lua");
    });
  });

  describe("getLanguageForFile", () => {
    it("should resolve src/main.py to python", () => {
      const registry = new ServerRegistry();
      expect(registry.getLanguageForFile("src/main.py")).toBe("python");
    });

    it("should resolve lib/utils.ts to typescript", () => {
      const registry = new ServerRegistry();
      expect(registry.getLanguageForFile("lib/utils.ts")).toBe("typescript");
    });
  });

  describe("user overrides", () => {
    it("should override typescript command to custom path", () => {
      const registry = new ServerRegistry([
        { languageId: "typescript", command: "/custom/path" },
      ]);

      const config = registry.getConfigForLanguage("typescript");
      expect(config).toBeDefined();
      expect(config!.command).toBe("/custom/path");
      // Original extensions should remain
      expect(config!.extensions).toContain("ts");
    });
  });

  describe("override adds new language", () => {
    it("should add zig language via override and route extensions", () => {
      const registry = new ServerRegistry([
        {
          languageId: "zig",
          command: "zls",
          extensions: ["zig"],
        },
      ]);

      expect(registry.getLanguageForExtension("zig")).toBe("zig");
      expect(registry.getConfigForLanguage("zig")).toBeDefined();
      expect(registry.getConfigForLanguage("zig")!.command).toBe("zls");
      expect(registry.getAllConfigs()).toHaveLength(13);
    });
  });

  describe("getSupportedExtensions", () => {
    it("should return all known extensions", () => {
      const registry = new ServerRegistry();
      const extensions = registry.getSupportedExtensions();

      // Must include extensions from all 12 servers
      expect(extensions).toContain("ts");
      expect(extensions).toContain("py");
      expect(extensions).toContain("rs");
      expect(extensions).toContain("go");
      expect(extensions).toContain("java");
      expect(extensions).toContain("cpp");
      expect(extensions).toContain("rb");
      expect(extensions).toContain("php");
      expect(extensions).toContain("kt");
      expect(extensions).toContain("swift");
      expect(extensions).toContain("cs");
      expect(extensions).toContain("lua");
    });
  });

  describe("getConfigForLanguage", () => {
    it("should return full config for known language", () => {
      const registry = new ServerRegistry();
      const config = registry.getConfigForLanguage("typescript");

      expect(config).toBeDefined();
      expect(config!.languageId).toBe("typescript");
      expect(config!.command).toBe("typescript-language-server");
      expect(config!.args).toEqual(["--stdio"]);
      expect(config!.extensions).toContain("ts");
      expect(config!.configFiles).toContain("tsconfig.json");
    });

    it("should return undefined for unknown language", () => {
      const registry = new ServerRegistry();
      expect(registry.getConfigForLanguage("brainfuck")).toBeUndefined();
    });
  });

  describe("unknown extension", () => {
    it("should return undefined for .xyz", () => {
      const registry = new ServerRegistry();
      expect(registry.getLanguageForExtension("xyz")).toBeUndefined();
    });
  });
});
