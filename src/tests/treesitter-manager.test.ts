/**
 * TDD Red: Tests for TreeSitterManager — WASM runtime loader + parser cache.
 * Tests real grammar loading (Python, Go) and graceful degradation.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  TreeSitterManager,
  isTreeSitterAvailable,
  resetTreeSitterLoader,
} from "../core/code/treesitter/treesitter-manager.js";

describe("TreeSitterManager", () => {
  let manager: TreeSitterManager;
  let wasmAvailable: boolean;

  beforeAll(async () => {
    resetTreeSitterLoader();
    manager = new TreeSitterManager();
    await manager.initialize();
    wasmAvailable = await isTreeSitterAvailable();
  });

  describe("initialize", () => {
    it("should be safe to call initialize multiple times", async () => {
      await manager.initialize();
      await manager.initialize();
      // Just verifying no crash — availability depends on platform
    });
  });

  describe("getParser", () => {
    it("should return a valid parser for Python when WASM is available", async () => {
      if (!wasmAvailable) return; // graceful skip on platforms without WASM
      const parser = await manager.getParser("python");
      expect(parser).not.toBeNull();
    });

    it("should return a valid parser for Go when WASM is available", async () => {
      if (!wasmAvailable) return;
      const parser = await manager.getParser("go");
      expect(parser).not.toBeNull();
    });

    it("should return a valid parser for Rust when WASM is available", async () => {
      if (!wasmAvailable) return;
      const parser = await manager.getParser("rust");
      expect(parser).not.toBeNull();
    });

    it("should return a valid parser for Java when WASM is available", async () => {
      if (!wasmAvailable) return;
      const parser = await manager.getParser("java");
      expect(parser).not.toBeNull();
    });

    it("should return null for unsupported language", async () => {
      const parser = await manager.getParser("brainfuck");
      expect(parser).toBeNull();
    });

    it("should cache parser — second call returns same instance", async () => {
      if (!wasmAvailable) return;
      const parser1 = await manager.getParser("python");
      const parser2 = await manager.getParser("python");
      expect(parser1).toBe(parser2);
    });
  });

  describe("parse capability", () => {
    it("should parse Python source code into a tree", async () => {
      if (!wasmAvailable) return;
      const parser = await manager.getParser("python");
      expect(parser).not.toBeNull();

      const tree = parser!.parse("def hello():\n  return 42\n");
      expect(tree).not.toBeNull();
      expect(tree.rootNode.type).toBe("module");
      expect(tree.rootNode.childCount).toBeGreaterThan(0);
    });

    it("should parse Go source code into a tree", async () => {
      if (!wasmAvailable) return;
      const parser = await manager.getParser("go");
      expect(parser).not.toBeNull();

      const tree = parser!.parse("package main\n\nfunc hello() int {\n  return 42\n}\n");
      expect(tree).not.toBeNull();
      expect(tree.rootNode.type).toBe("source_file");
    });
  });

  describe("getSupportedLanguages", () => {
    it("should list languages with available grammars", () => {
      const langs = manager.getSupportedLanguages();
      expect(langs).toContain("python");
      expect(langs).toContain("go");
      expect(langs).toContain("rust");
      expect(langs).not.toContain("brainfuck");
    });
  });

  describe("isLanguageSupported", () => {
    it("should return true for languages with registered grammars", () => {
      expect(manager.isLanguageSupported("python")).toBe(true);
      expect(manager.isLanguageSupported("go")).toBe(true);
    });

    it("should return false for unknown languages", () => {
      expect(manager.isLanguageSupported("brainfuck")).toBe(false);
    });
  });
});
