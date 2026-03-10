/**
 * Unit tests for code-graph-guards.ts — isCodeGraphData + isImpactResult.
 * Tests the actual production module via direct import.
 */
import { describe, it, expect } from "vitest";
import { isCodeGraphData, isImpactResult } from "../web/dashboard/src/lib/code-graph-guards.js";

// ── isCodeGraphData ──────────────────────────────

describe("isCodeGraphData", () => {
  it("should return true for valid CodeGraphData with empty arrays", () => {
    expect(isCodeGraphData({ symbols: [], relations: [] })).toBe(true);
  });

  it("should return true for CodeGraphData with populated symbols", () => {
    const data = {
      symbols: [
        { name: "foo", kind: "function", file: "bar.ts", startLine: 1, endLine: 10 },
      ],
      relations: [
        { from: "foo", to: "bar", type: "calls" },
      ],
    };
    expect(isCodeGraphData(data)).toBe(true);
  });

  it("should return false for null", () => {
    expect(isCodeGraphData(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isCodeGraphData(undefined)).toBe(false);
  });

  it("should return false for non-object (string)", () => {
    expect(isCodeGraphData("string")).toBe(false);
  });

  it("should return false for non-object (number)", () => {
    expect(isCodeGraphData(42)).toBe(false);
  });

  it("should return false for non-object (boolean)", () => {
    expect(isCodeGraphData(true)).toBe(false);
  });

  it("should return false for object without symbols field", () => {
    expect(isCodeGraphData({ relations: [] })).toBe(false);
  });

  it("should return false for object with non-array symbols", () => {
    expect(isCodeGraphData({ symbols: "not-array" })).toBe(false);
  });

  it("should return false for object with symbols as object (not array)", () => {
    expect(isCodeGraphData({ symbols: {} })).toBe(false);
  });

  it("should return true even without relations field (guard only checks symbols)", () => {
    expect(isCodeGraphData({ symbols: [] })).toBe(true);
  });

  it("should narrow type correctly (TypeScript type guard)", () => {
    const data: unknown = { symbols: [{ name: "x", kind: "class" }], relations: [] };
    if (isCodeGraphData(data)) {
      // TypeScript should know data.symbols exists
      expect(data.symbols[0].name).toBe("x");
    }
  });
});

// ── isImpactResult ───────────────────────────────

describe("isImpactResult", () => {
  it("should return true for valid ImpactResult", () => {
    expect(isImpactResult({
      symbol: "SqliteStore",
      riskLevel: "low",
      affectedSymbols: [{ name: "foo", file: "bar.ts", confidence: 0.9 }],
    })).toBe(true);
  });

  it("should return true for ImpactResult with empty affected list", () => {
    expect(isImpactResult({
      symbol: "x",
      riskLevel: "high",
      affectedSymbols: [],
    })).toBe(true);
  });

  it("should return false for null", () => {
    expect(isImpactResult(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isImpactResult(undefined)).toBe(false);
  });

  it("should return false for non-object", () => {
    expect(isImpactResult("string")).toBe(false);
    expect(isImpactResult(42)).toBe(false);
  });

  it("should return false for object missing riskLevel", () => {
    expect(isImpactResult({ affectedSymbols: [], symbol: "x" })).toBe(false);
  });

  it("should return false for object missing affectedSymbols", () => {
    expect(isImpactResult({ riskLevel: "low", symbol: "x" })).toBe(false);
  });

  it("should return false for empty object", () => {
    expect(isImpactResult({})).toBe(false);
  });

  it("should return true even without symbol field (guard checks riskLevel + affectedSymbols)", () => {
    expect(isImpactResult({ riskLevel: "medium", affectedSymbols: [] })).toBe(true);
  });

  it("should narrow type correctly (TypeScript type guard)", () => {
    const data: unknown = { symbol: "X", riskLevel: "high", affectedSymbols: [] };
    if (isImpactResult(data)) {
      expect(data.riskLevel).toBe("high");
      expect(data.affectedSymbols).toEqual([]);
    }
  });
});
