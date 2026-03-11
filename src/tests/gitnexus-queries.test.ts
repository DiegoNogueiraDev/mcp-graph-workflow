import { describe, it, expect } from "vitest";

import {
  buildContextQuery,
  buildImpactQuery,
  parseContextResponse,
  parseImpactResponse,
  calculateRiskLevel,
} from "../core/integrations/gitnexus-queries.js";

describe("gitnexus-queries", () => {
  // ── buildContextQuery ──────────────────────────────

  describe("buildContextQuery", () => {
    it("should build valid context Cypher for symbol name", () => {
      const query = buildContextQuery("SqliteStore");
      expect(query).toContain("SqliteStore");
      expect(query).toContain("MATCH");
      expect(query).toContain("RETURN");
      expect(query).toContain("CodeRelation");
    });

    it("should escape single quotes in symbol name", () => {
      const query = buildContextQuery("it's");
      expect(query).toContain("\\'s");
    });
  });

  // ── buildImpactQuery ───────────────────────────────

  describe("buildImpactQuery", () => {
    it("should build valid impact Cypher for symbol name", () => {
      const query = buildImpactQuery("buildTaskContext");
      expect(query).toContain("buildTaskContext");
      expect(query).toContain("CALLS");
      expect(query).toContain("IMPORTS");
      expect(query).toContain("CodeRelation");
    });

    it("should escape single quotes in symbol name", () => {
      const query = buildImpactQuery("O'Brien");
      expect(query).toContain("\\'Brien");
    });
  });

  // ── calculateRiskLevel ─────────────────────────────

  describe("calculateRiskLevel", () => {
    it("should return low for less than 5 affected symbols", () => {
      expect(calculateRiskLevel(0)).toBe("low");
      expect(calculateRiskLevel(4)).toBe("low");
    });

    it("should return medium for 5-15 affected symbols", () => {
      expect(calculateRiskLevel(5)).toBe("medium");
      expect(calculateRiskLevel(15)).toBe("medium");
    });

    it("should return high for more than 15 affected symbols", () => {
      expect(calculateRiskLevel(16)).toBe("high");
      expect(calculateRiskLevel(100)).toBe("high");
    });
  });

  // ── parseContextResponse ───────────────────────────

  describe("parseContextResponse", () => {
    it("should parse context response into CodeGraphData", () => {
      const raw = {
        result: [
          {
            s: { name: "SqliteStore", kind: "class", file: "sqlite-store.ts" },
            relType: "CALLS",
            related: { name: "openDb", kind: "function", file: "sqlite-store.ts" },
          },
          {
            s: { name: "SqliteStore", kind: "class", file: "sqlite-store.ts" },
            relType: "IMPORTS",
            related: { name: "Database", kind: "class", file: "better-sqlite3" },
          },
        ],
      };

      const result = parseContextResponse(raw);

      expect(result.symbols).toHaveLength(3);
      expect(result.symbols.map((s) => s.name)).toContain("SqliteStore");
      expect(result.symbols.map((s) => s.name)).toContain("openDb");
      expect(result.symbols.map((s) => s.name)).toContain("Database");
      expect(result.relations).toHaveLength(2);
      expect(result.relations[0].type).toBe("calls");
    });

    it("should handle empty results gracefully", () => {
      const result = parseContextResponse({ result: [] });
      expect(result.symbols).toHaveLength(0);
      expect(result.relations).toHaveLength(0);
    });

    it("should handle null input gracefully", () => {
      const result = parseContextResponse(null);
      expect(result.symbols).toHaveLength(0);
      expect(result.relations).toHaveLength(0);
    });

    it("should handle array format directly", () => {
      const raw = [
        {
          s: { name: "foo", kind: "function" },
          relType: "CALLS",
          related: { name: "bar", kind: "function" },
        },
      ];

      const result = parseContextResponse(raw);
      expect(result.symbols).toHaveLength(2);
      expect(result.relations).toHaveLength(1);
    });

    it("should deduplicate symbols by name", () => {
      const raw = {
        result: [
          {
            s: { name: "A", kind: "class" },
            relType: "CALLS",
            related: { name: "B", kind: "function" },
          },
          {
            s: { name: "A", kind: "class" },
            relType: "IMPORTS",
            related: { name: "C", kind: "module" },
          },
        ],
      };

      const result = parseContextResponse(raw);
      // A appears twice in records but should be deduplicated
      const aSymbols = result.symbols.filter((s) => s.name === "A");
      expect(aSymbols).toHaveLength(1);
    });
  });

  // ── parseImpactResponse ────────────────────────────

  describe("parseImpactResponse", () => {
    it("should parse impact response into ImpactResult", () => {
      const raw = {
        result: [
          { name: "handler1", file: "handler.ts", kind: "function", depth: 1 },
          { name: "handler2", file: "handler2.ts", kind: "function", depth: 2 },
          { name: "handler3", file: "handler3.ts", kind: "function", depth: 3 },
        ],
      };

      const result = parseImpactResponse(raw, "targetFn");

      expect(result.symbol).toBe("targetFn");
      expect(result.affectedSymbols).toHaveLength(3);
      expect(result.riskLevel).toBe("low");
    });

    it("should calculate confidence based on depth", () => {
      const raw = {
        result: [
          { name: "direct", file: "a.ts", depth: 1 },
          { name: "indirect", file: "b.ts", depth: 2 },
          { name: "transitive", file: "c.ts", depth: 3 },
        ],
      };

      const result = parseImpactResponse(raw, "target");

      expect(result.affectedSymbols[0].confidence).toBe(1.0);
      expect(result.affectedSymbols[1].confidence).toBeCloseTo(0.7);
      expect(result.affectedSymbols[2].confidence).toBeCloseTo(0.4);
    });

    it("should handle empty results gracefully", () => {
      const result = parseImpactResponse({ result: [] }, "noHits");
      expect(result.affectedSymbols).toHaveLength(0);
      expect(result.riskLevel).toBe("low");
      expect(result.symbol).toBe("noHits");
    });

    it("should handle null input gracefully", () => {
      const result = parseImpactResponse(null, "sym");
      expect(result.affectedSymbols).toHaveLength(0);
      expect(result.riskLevel).toBe("low");
    });

    it("should calculate risk level based on affected count", () => {
      const records = Array.from({ length: 20 }, (_, i) => ({
        name: `sym${i}`,
        file: `file${i}.ts`,
        depth: 1,
      }));

      const result = parseImpactResponse({ result: records }, "bigTarget");
      expect(result.riskLevel).toBe("high");
      expect(result.affectedSymbols).toHaveLength(20);
    });
  });
});
