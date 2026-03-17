/**
 * Integration tests for the enriched next tool output.
 * Validates that findEnhancedNextTask + generateTddHints produce
 * the expected enriched response structure.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { findEnhancedNextTask } from "../../core/planner/enhanced-next.js";
import { generateTddHints } from "../../core/implementer/tdd-checker.js";
import { makeNode } from "../helpers/factories.js";

describe("next tool enriched output (integration)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return null when no tasks exist", () => {
    const doc = store.toGraphDocument();
    const result = findEnhancedNextTask(doc, store);
    expect(result).toBeNull();
  });

  it("should return enriched result with knowledgeCoverage and velocityContext", () => {
    store.insertNode(makeNode({
      type: "task",
      title: "Build auth service",
      xpSize: "M",
      acceptanceCriteria: ["Should validate JWT tokens"],
    }));

    const doc = store.toGraphDocument();
    const result = findEnhancedNextTask(doc, store);

    expect(result).not.toBeNull();
    expect(result!.knowledgeCoverage).toBeGreaterThanOrEqual(0);
    expect(result!.knowledgeCoverage).toBeLessThanOrEqual(1);
    expect(result!.velocityContext).toBeDefined();
    expect(result!.velocityContext).toHaveProperty("avgCompletionHours");
    expect(result!.velocityContext).toHaveProperty("estimatedHours");
    expect(result!.enhancedReason).toBeTruthy();
  });

  it("should generate tddHints for task with GWT acceptance criteria", () => {
    const task = makeNode({
      type: "task",
      acceptanceCriteria: [
        "Given a valid token\nWhen the user requests /profile\nThen should return user data",
      ],
    });
    store.insertNode(task);

    const doc = store.toGraphDocument();
    const result = findEnhancedNextTask(doc, store);
    expect(result).not.toBeNull();

    const hints = generateTddHints(result!.task.node);
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]).toHaveProperty("testName");
    expect(hints[0]).toHaveProperty("fromAc");
    expect(hints[0]).toHaveProperty("type");
    expect(hints[0].testName).toContain("should");
  });

  it("should return empty tddHints for task without AC", () => {
    store.insertNode(makeNode({ type: "task", title: "Setup CI" }));

    const doc = store.toGraphDocument();
    const result = findEnhancedNextTask(doc, store);
    expect(result).not.toBeNull();

    const hints = generateTddHints(result!.task.node);
    expect(hints).toHaveLength(0);
  });

  it("should generate hints with correct test type inference", () => {
    const task = makeNode({
      type: "task",
      acceptanceCriteria: [
        "Should save the record to database",
        "Should navigate to the settings page",
        "Should return a valid JSON response",
      ],
    });
    store.insertNode(task);

    const hints = generateTddHints(task);
    expect(hints.length).toBe(3);

    const saveHint = hints.find((h) => h.fromAc.includes("save"));
    const navHint = hints.find((h) => h.fromAc.includes("navigate"));
    const returnHint = hints.find((h) => h.fromAc.includes("return"));

    expect(saveHint!.type).toBe("integration");
    expect(navHint!.type).toBe("e2e");
    expect(returnHint!.type).toBe("unit");
  });
});
