/**
 * Tests TypeScript graceful degradation in isolation.
 * This file uses vi.mock("typescript") which hoists — must be separate from main tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";

// Mock typescript BEFORE importing the analyzer — vi.mock is hoisted
vi.mock("typescript", () => {
  throw new Error("Cannot find module 'typescript'");
});

// Dynamic import so the mock takes effect
const { analyzeFile, resetTypeScriptLoader } = await import("../core/code/ts-analyzer.js");

const FIXTURE_DIR = path.join(import.meta.dirname, "__fixtures__", "ts-analyzer-degrade");

describe("ts-analyzer graceful degradation", () => {
  beforeEach(() => {
    mkdirSync(FIXTURE_DIR, { recursive: true });
    writeFileSync(
      path.join(FIXTURE_DIR, "sample.ts"),
      'export function hello(): string { return "hi"; }',
    );
    resetTypeScriptLoader();
  });

  afterEach(() => {
    rmSync(FIXTURE_DIR, { recursive: true, force: true });
  });

  it("should return empty symbols and relations when typescript is unavailable", async () => {
    const result = await analyzeFile(path.join(FIXTURE_DIR, "sample.ts"), FIXTURE_DIR);

    expect(result.file).toBe("sample.ts");
    expect(result.symbols).toEqual([]);
    expect(result.relations).toEqual([]);
  });
});
