/**
 * TDD Red: Tests for TreeSitterAnalyzer — multi-language CodeAnalyzer.
 * Validates symbol extraction, relations, docstrings, and visibility
 * using real tree-sitter parsing of Python and Go source strings.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TreeSitterAnalyzer } from "../core/code/treesitter/treesitter-analyzer.js";
import { resetTreeSitterLoader } from "../core/code/treesitter/treesitter-manager.js";

const PYTHON_SOURCE = `"""Module docstring."""

import os
from pathlib import Path

class MyClass:
    """A sample class."""

    def __init__(self, name):
        self.name = name

    def greet(self):
        """Return greeting."""
        return f"Hello {self.name}"

def calculate_tax(income, rate=0.3):
    """Calculate the tax amount based on income."""
    return income * rate

def _private_helper():
    pass

result = calculate_tax(50000)
`;

const GO_SOURCE = `package handlers

import "net/http"

// HandleRequest processes incoming HTTP requests.
func HandleRequest(w http.ResponseWriter, r *http.Request) {
\tvalidateInput(r)
\tw.WriteHeader(200)
}

// validateInput checks request parameters.
func validateInput(r *http.Request) bool {
\treturn r.Method == "GET"
}

// Config holds server configuration.
type Config struct {
\tPort int
\tHost string
}
`;

describe("TreeSitterAnalyzer", () => {
  let analyzer: TreeSitterAnalyzer;
  let tempDir: string;

  beforeAll(async () => {
    resetTreeSitterLoader();
    analyzer = new TreeSitterAnalyzer();
    await analyzer.initialize();
    tempDir = join(tmpdir(), `ts-analyzer-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  it("should implement CodeAnalyzer interface", () => {
    expect(analyzer.languages.length).toBeGreaterThan(0);
    expect(analyzer.extensions.length).toBeGreaterThan(0);
    expect(typeof analyzer.analyzeFile).toBe("function");
  });

  it("should have python and go in languages", () => {
    expect(analyzer.languages).toContain("python");
    expect(analyzer.languages).toContain("go");
  });

  it("should have .py and .go in extensions", () => {
    expect(analyzer.extensions).toContain(".py");
    expect(analyzer.extensions).toContain(".go");
  });

  describe("Python analysis", () => {
    it("should extract functions and classes from Python", async () => {
      const filePath = join(tempDir, "sample.py");
      writeFileSync(filePath, PYTHON_SOURCE);

      const result = await analyzer.analyzeFile(filePath, tempDir);

      expect(result.file).toBe("sample.py");
      expect(result.symbols.length).toBeGreaterThanOrEqual(3);

      const funcNames = result.symbols.map((s) => s.name);
      expect(funcNames).toContain("MyClass");
      expect(funcNames).toContain("calculate_tax");
      expect(funcNames).toContain("_private_helper");
    });

    it("should set language='python' on all symbols", async () => {
      const filePath = join(tempDir, "lang.py");
      writeFileSync(filePath, "def foo():\n  pass\n");

      const result = await analyzer.analyzeFile(filePath, tempDir);
      for (const sym of result.symbols) {
        expect(sym.language).toBe("python");
      }
    });

    it("should extract docstrings from Python functions", async () => {
      const filePath = join(tempDir, "doc.py");
      writeFileSync(filePath, PYTHON_SOURCE);

      const result = await analyzer.analyzeFile(filePath, tempDir);
      const calcTax = result.symbols.find((s) => s.name === "calculate_tax");
      expect(calcTax).toBeDefined();
      expect(calcTax!.docstring).toContain("Calculate the tax amount");
    });

    it("should detect _private visibility via underscore prefix", async () => {
      const filePath = join(tempDir, "vis.py");
      writeFileSync(filePath, PYTHON_SOURCE);

      const result = await analyzer.analyzeFile(filePath, tempDir);
      const priv = result.symbols.find((s) => s.name === "_private_helper");
      expect(priv).toBeDefined();
      expect(priv!.visibility).toBe("private");

      const pub = result.symbols.find((s) => s.name === "calculate_tax");
      expect(pub!.visibility).toBe("public");
    });

    it("should extract import relations", async () => {
      const filePath = join(tempDir, "imp.py");
      writeFileSync(filePath, PYTHON_SOURCE);

      const result = await analyzer.analyzeFile(filePath, tempDir);
      const imports = result.relations.filter((r) => r.type === "imports");
      expect(imports.length).toBeGreaterThanOrEqual(1);
    });

    it("should extract call relations", async () => {
      const filePath = join(tempDir, "call.py");
      writeFileSync(filePath, PYTHON_SOURCE);

      const result = await analyzer.analyzeFile(filePath, tempDir);
      const calls = result.relations.filter((r) => r.type === "calls");
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Go analysis", () => {
    it("should extract functions and structs from Go", async () => {
      const filePath = join(tempDir, "handler.go");
      writeFileSync(filePath, GO_SOURCE);

      const result = await analyzer.analyzeFile(filePath, tempDir);

      expect(result.file).toBe("handler.go");
      const names = result.symbols.map((s) => s.name);
      expect(names).toContain("HandleRequest");
      expect(names).toContain("validateInput");
      expect(names).toContain("Config");
    });

    it("should set language='go' on all symbols", async () => {
      const filePath = join(tempDir, "lang.go");
      writeFileSync(filePath, GO_SOURCE);

      const result = await analyzer.analyzeFile(filePath, tempDir);
      for (const sym of result.symbols) {
        expect(sym.language).toBe("go");
      }
    });

    it("should detect Go export via uppercase first letter", async () => {
      const filePath = join(tempDir, "exp.go");
      writeFileSync(filePath, GO_SOURCE);

      const result = await analyzer.analyzeFile(filePath, tempDir);
      const handleReq = result.symbols.find((s) => s.name === "HandleRequest");
      expect(handleReq!.exported).toBe(true);

      const validate = result.symbols.find((s) => s.name === "validateInput");
      expect(validate!.exported).toBe(false);
    });

    it("should extract GoDoc comments as docstring", async () => {
      const filePath = join(tempDir, "godoc.go");
      writeFileSync(filePath, GO_SOURCE);

      const result = await analyzer.analyzeFile(filePath, tempDir);
      const handleReq = result.symbols.find((s) => s.name === "HandleRequest");
      expect(handleReq!.docstring).toContain("processes incoming HTTP requests");
    });

    it("should detect struct kind", async () => {
      const filePath = join(tempDir, "struct.go");
      writeFileSync(filePath, GO_SOURCE);

      const result = await analyzer.analyzeFile(filePath, tempDir);
      const config = result.symbols.find((s) => s.name === "Config");
      expect(config).toBeDefined();
      expect(config!.kind).toBe("struct");
    });
  });

  describe("unsupported extensions", () => {
    it("should return empty result for unknown file type", async () => {
      const filePath = join(tempDir, "readme.md");
      writeFileSync(filePath, "# Hello");

      const result = await analyzer.analyzeFile(filePath, tempDir);
      expect(result.symbols).toHaveLength(0);
      expect(result.relations).toHaveLength(0);
    });
  });
});
