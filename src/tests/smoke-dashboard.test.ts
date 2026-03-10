/**
 * Smoke tests for dashboard modules.
 * Verifies that all new modules export correctly, constants are sane,
 * and the build pipeline didn't break imports.
 */
import { describe, it, expect } from "vitest";
import {
  filterTopLevelNodes,
  TOP_LEVEL_TYPES,
} from "../web/dashboard/src/lib/graph-filters.js";
import {
  buildMemoryTree,
} from "../web/dashboard/src/lib/memory-tree.js";
import {
  isCodeGraphData,
  isImpactResult,
} from "../web/dashboard/src/lib/code-graph-guards.js";

describe("Smoke: Dashboard Modules", () => {
  // ── graph-filters.ts ────────────────────────────

  describe("graph-filters module", () => {
    it("should export filterTopLevelNodes as a function", () => {
      expect(typeof filterTopLevelNodes).toBe("function");
    });

    it("should export TOP_LEVEL_TYPES as a Set", () => {
      expect(TOP_LEVEL_TYPES).toBeInstanceOf(Set);
    });

    it("filterTopLevelNodes should not throw on empty input", () => {
      expect(() => filterTopLevelNodes([], false)).not.toThrow();
      expect(() => filterTopLevelNodes([], true)).not.toThrow();
    });

    it("filterTopLevelNodes should return an array", () => {
      const result = filterTopLevelNodes([], false);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ── memory-tree.ts ──────────────────────────────

  describe("memory-tree module", () => {
    it("should export buildMemoryTree as a function", () => {
      expect(typeof buildMemoryTree).toBe("function");
    });

    it("buildMemoryTree should not throw on empty input", () => {
      expect(() => buildMemoryTree([])).not.toThrow();
    });

    it("buildMemoryTree should return an array", () => {
      expect(Array.isArray(buildMemoryTree([]))).toBe(true);
    });
  });

  // ── code-graph-guards.ts ────────────────────────

  describe("code-graph-guards module", () => {
    it("should export isCodeGraphData as a function", () => {
      expect(typeof isCodeGraphData).toBe("function");
    });

    it("should export isImpactResult as a function", () => {
      expect(typeof isImpactResult).toBe("function");
    });

    it("guards should handle all primitive types without throwing", () => {
      const primitives = [null, undefined, 0, "", false, [], {}];
      for (const val of primitives) {
        expect(() => isCodeGraphData(val)).not.toThrow();
        expect(() => isImpactResult(val)).not.toThrow();
      }
    });

    it("guards should return boolean", () => {
      expect(typeof isCodeGraphData(null)).toBe("boolean");
      expect(typeof isImpactResult(null)).toBe("boolean");
    });
  });

  // ── Cross-module consistency ────────────────────

  describe("cross-module consistency", () => {
    it("TOP_LEVEL_TYPES should match filterTopLevelNodes behavior", () => {
      const topLevelNode = { type: "epic", parentId: "some-parent" };
      const nonTopLevelNode = { type: "task", parentId: "some-parent" };

      const result = filterTopLevelNodes([topLevelNode, nonTopLevelNode], false);
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("epic");
    });

    it("type guards should be mutually exclusive for valid data", () => {
      const codeGraph = { symbols: [], relations: [] };
      const impact = { riskLevel: "low", affectedSymbols: [], symbol: "x" };

      expect(isCodeGraphData(codeGraph)).toBe(true);
      expect(isImpactResult(codeGraph)).toBe(false);

      expect(isImpactResult(impact)).toBe(true);
      expect(isCodeGraphData(impact)).toBe(false);
    });
  });
});
