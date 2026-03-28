import { describe, it, expect } from "vitest";
import {
  getSiebelBestPractices,
  getBestPracticesByCategory,
} from "../../core/siebel/best-practices.js";

describe("best-practices", () => {
  it("should have 50+ rules", () => {
    const rules = getSiebelBestPractices();
    expect(rules.length).toBeGreaterThanOrEqual(50);
  });

  it("should categorize rules by object type", () => {
    const categories = getBestPracticesByCategory();
    expect(Object.keys(categories).length).toBeGreaterThanOrEqual(5);
    expect(categories["business_component"]).toBeDefined();
    expect(categories["applet"]).toBeDefined();
    expect(categories["scripting"]).toBeDefined();
  });

  it("should have correct and incorrect examples for each rule", () => {
    const rules = getSiebelBestPractices();
    for (const rule of rules) {
      expect(rule.correct).toBeDefined();
      expect(rule.correct.length).toBeGreaterThan(0);
      expect(rule.incorrect).toBeDefined();
      expect(rule.incorrect.length).toBeGreaterThan(0);
    }
  });

  it("should have severity on every rule", () => {
    const rules = getSiebelBestPractices();
    for (const rule of rules) {
      expect(["error", "warning", "info"]).toContain(rule.severity);
    }
  });

  it("should have unique rule IDs", () => {
    const rules = getSiebelBestPractices();
    const ids = rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should include naming, configuration, and scripting categories", () => {
    const categories = getBestPracticesByCategory();
    expect(categories["naming"]).toBeDefined();
    expect(categories["configuration"]).toBeDefined();
    expect(categories["scripting"]).toBeDefined();
  });
});
