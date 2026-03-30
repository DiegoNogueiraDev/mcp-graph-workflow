/**
 * TDD Red: Tests for AnalyzerFactory — auto-detect languages and create analyzers.
 * Validates TsAnalyzer priority, TreeSitterAnalyzer inclusion for non-TS languages,
 * and no extension overlap.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAnalyzers } from "../core/code/analyzer-factory.js";
import { TsAnalyzer } from "../core/code/ts-analyzer.js";
import { TreeSitterAnalyzer } from "../core/code/treesitter/treesitter-analyzer.js";

describe("AnalyzerFactory — createAnalyzers", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `analyzer-factory-test-${Date.now()}`);
    mkdirSync(tempDir, { recursive: true });
  });

  it("should always include TsAnalyzer", async () => {
    // Even empty project gets TsAnalyzer
    const analyzers = await createAnalyzers(tempDir);
    const hasTsAnalyzer = analyzers.some((a) => a instanceof TsAnalyzer);
    expect(hasTsAnalyzer).toBe(true);
  });

  it("should include TsAnalyzer for project with tsconfig.json", async () => {
    writeFileSync(join(tempDir, "tsconfig.json"), "{}");
    const analyzers = await createAnalyzers(tempDir);
    const hasTsAnalyzer = analyzers.some((a) => a instanceof TsAnalyzer);
    expect(hasTsAnalyzer).toBe(true);
  });

  it("should include TreeSitterAnalyzer when go.mod present", async () => {
    writeFileSync(join(tempDir, "go.mod"), "module example.com/myproject\n\ngo 1.21\n");
    writeFileSync(join(tempDir, "main.go"), "package main\nfunc main() {}\n");
    const analyzers = await createAnalyzers(tempDir);
    const hasTreeSitter = analyzers.some((a) => a instanceof TreeSitterAnalyzer);
    expect(hasTreeSitter).toBe(true);
  });

  it("should include TreeSitterAnalyzer when pyproject.toml present", async () => {
    writeFileSync(join(tempDir, "pyproject.toml"), "[project]\nname = 'myproject'\n");
    writeFileSync(join(tempDir, "app.py"), "def main():\n  pass\n");
    const analyzers = await createAnalyzers(tempDir);
    const hasTreeSitter = analyzers.some((a) => a instanceof TreeSitterAnalyzer);
    expect(hasTreeSitter).toBe(true);
  });

  it("should return both analyzers for mixed TS + Python project", async () => {
    writeFileSync(join(tempDir, "tsconfig.json"), "{}");
    writeFileSync(join(tempDir, "pyproject.toml"), "[project]\nname = 'myproject'\n");
    writeFileSync(join(tempDir, "index.ts"), "export const x = 1;\n");
    writeFileSync(join(tempDir, "script.py"), "x = 1\n");
    const analyzers = await createAnalyzers(tempDir);
    expect(analyzers.length).toBeGreaterThanOrEqual(2);
    expect(analyzers.some((a) => a instanceof TsAnalyzer)).toBe(true);
    expect(analyzers.some((a) => a instanceof TreeSitterAnalyzer)).toBe(true);
  });

  it("should not have extension overlap — TsAnalyzer owns .ts/.js", async () => {
    writeFileSync(join(tempDir, "tsconfig.json"), "{}");
    writeFileSync(join(tempDir, "pyproject.toml"), "[project]\nname = 'myproject'\n");
    writeFileSync(join(tempDir, "app.py"), "x = 1\n");
    const analyzers = await createAnalyzers(tempDir);

    const tsAnalyzer = analyzers.find((a) => a instanceof TsAnalyzer)!;
    const tsExtensions = new Set(tsAnalyzer.extensions);

    for (const analyzer of analyzers) {
      if (analyzer instanceof TsAnalyzer) continue;
      for (const ext of analyzer.extensions) {
        expect(tsExtensions.has(ext)).toBe(false);
      }
    }
  });

  it("should always include TsAnalyzer as first analyzer for TS project", async () => {
    writeFileSync(join(tempDir, "tsconfig.json"), "{}");
    writeFileSync(join(tempDir, "index.ts"), "export const x = 1;\n");
    const analyzers = await createAnalyzers(tempDir);
    // TsAnalyzer is always the first analyzer
    expect(analyzers.length).toBeGreaterThanOrEqual(1);
    expect(analyzers[0]).toBeInstanceOf(TsAnalyzer);
  });
});
