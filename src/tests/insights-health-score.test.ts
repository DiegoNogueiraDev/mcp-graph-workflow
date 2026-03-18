import { describe, it, expect } from "vitest";
import { computeHealthScore } from "../web/dashboard/src/lib/health-score.js";
import type { HealthScoreInput } from "../web/dashboard/src/lib/health-score.js";

function makeInput(overrides: Partial<HealthScoreInput> = {}): HealthScoreInput {
  return {
    completionRate: 50,
    totalNodes: 10,
    blockedCount: 0,
    missingACCount: 0,
    oversizedCount: 0,
    ...overrides,
  };
}

describe("computeHealthScore", () => {
  it("should return 100 for an empty graph", () => {
    const score = computeHealthScore(makeInput({ totalNodes: 0, completionRate: 0 }));
    expect(score).toBe(100);
  });

  it("should return a high score when 100% done and no blockers", () => {
    const score = computeHealthScore(makeInput({ completionRate: 100, totalNodes: 10 }));
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it("should penalize when many tasks are blocked", () => {
    const score = computeHealthScore(makeInput({
      completionRate: 10,
      totalNodes: 10,
      blockedCount: 8,
      missingACCount: 5,
    }));
    expect(score).toBeLessThan(40);
  });

  it("should penalize missing acceptance criteria", () => {
    const scoreWithAC = computeHealthScore(makeInput({ missingACCount: 0 }));
    const scoreWithoutAC = computeHealthScore(makeInput({ missingACCount: 8 }));
    expect(scoreWithoutAC).toBeLessThan(scoreWithAC);
  });

  it("should penalize oversized tasks", () => {
    const scoreClean = computeHealthScore(makeInput({ oversizedCount: 0 }));
    const scoreOversized = computeHealthScore(makeInput({ oversizedCount: 5 }));
    expect(scoreOversized).toBeLessThan(scoreClean);
  });

  it("should always return a value between 0 and 100", () => {
    const score = computeHealthScore(makeInput({
      completionRate: 0,
      totalNodes: 20,
      blockedCount: 20,
      missingACCount: 20,
      oversizedCount: 20,
    }));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
