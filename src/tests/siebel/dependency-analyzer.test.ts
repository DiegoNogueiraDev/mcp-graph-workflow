import { describe, it, expect } from "vitest";
import {
  analyzeSiebelImpact,
  findDependencyChain,
  detectCircularDeps,
} from "../../core/siebel/dependency-analyzer.js";
import { parseSifContent } from "../../core/siebel/sif-parser.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SiebelDependency } from "../../schemas/siebel.schema.js";

const SAMPLE_SIF_PATH = resolve(import.meta.dirname, "../fixtures/sample.sif");
const SAMPLE_SIF_CONTENT = readFileSync(SAMPLE_SIF_PATH, "utf-8");

describe("dependency-analyzer", () => {
  const parseResult = parseSifContent(SAMPLE_SIF_CONTENT, "sample.sif");
  const { dependencies } = parseResult;

  describe("analyzeSiebelImpact", () => {
    it("should find direct dependents of Account BC", () => {
      const result = analyzeSiebelImpact(dependencies, {
        name: "Account",
        type: "business_component",
      });

      expect(result.targetObject.name).toBe("Account");
      expect(result.directDependents.length).toBeGreaterThan(0);

      // Account List Applet references Account BC
      const appletDep = result.directDependents.find(
        (d) => d.name === "Account List Applet" && d.type === "applet",
      );
      expect(appletDep).toBeDefined();
    });

    it("should find transitive dependents", () => {
      const result = analyzeSiebelImpact(dependencies, {
        name: "Account",
        type: "business_component",
      });

      // Transitive: View → Applet → BC, so views should be in transitive
      expect(result.transitiveDependents.length).toBeGreaterThan(0);
      expect(result.totalAffected).toBeGreaterThan(result.directDependents.length);
    });

    it("should calculate risk level based on affected count", () => {
      const result = analyzeSiebelImpact(dependencies, {
        name: "Account",
        type: "business_component",
      });

      // Account BC has many dependents, should be medium or high risk
      expect(["medium", "high", "critical"]).toContain(result.riskLevel);
    });

    it("should return empty result for object with no dependents", () => {
      const result = analyzeSiebelImpact(dependencies, {
        name: "Nonexistent Object",
        type: "applet",
      });

      expect(result.directDependents).toHaveLength(0);
      expect(result.transitiveDependents).toHaveLength(0);
      expect(result.totalAffected).toBe(0);
      expect(result.riskLevel).toBe("low");
    });
  });

  describe("findDependencyChain", () => {
    it("should find a path from View to BC via Applet", () => {
      const chain = findDependencyChain(
        dependencies,
        { name: "Account List View", type: "view" },
        { name: "Account", type: "business_component" },
      );

      expect(chain.length).toBeGreaterThan(0);
    });

    it("should return empty for no path", () => {
      const chain = findDependencyChain(
        dependencies,
        { name: "Account List Applet", type: "applet" },
        { name: "Accounts Screen", type: "screen" },
      );

      expect(chain).toHaveLength(0);
    });
  });

  describe("detectCircularDeps", () => {
    it("should return empty for acyclic graph", () => {
      const cycles = detectCircularDeps(dependencies);
      expect(cycles).toHaveLength(0);
    });

    it("should detect circular dependency", () => {
      const circularDeps: SiebelDependency[] = [
        {
          from: { name: "A", type: "applet" },
          to: { name: "B", type: "business_component" },
          relationType: "references",
        },
        {
          from: { name: "B", type: "business_component" },
          to: { name: "C", type: "view" },
          relationType: "references",
        },
        {
          from: { name: "C", type: "view" },
          to: { name: "A", type: "applet" },
          relationType: "references",
        },
      ];

      const cycles = detectCircularDeps(circularDeps);
      expect(cycles.length).toBeGreaterThan(0);
    });
  });
});
