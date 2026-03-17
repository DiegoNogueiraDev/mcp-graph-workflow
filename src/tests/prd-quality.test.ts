import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { analyzePrdQuality } from "../core/analyzer/prd-quality.js";
import { makeNode } from "./helpers/factories.js";

describe("analyzePrdQuality", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("PRD Quality Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return F grade for empty graph", () => {
    const doc = store.toGraphDocument();
    const report = analyzePrdQuality(doc);

    expect(report.score).toBe(0);
    expect(report.grade).toBe("F");
    expect(report.readyForDesign).toBe(false);
  });

  it("should detect missing requirements", () => {
    store.insertNode(makeNode({ type: "task", title: "Some task" }));

    const doc = store.toGraphDocument();
    const report = analyzePrdQuality(doc);

    const reqSection = report.sections.find((s) => s.name === "requirements");
    expect(reqSection).toBeDefined();
    expect(reqSection!.quality).toBe("missing");
  });

  it("should score higher with requirements + tasks + AC", () => {
    store.insertNode(makeNode({ type: "epic", title: "Main epic", description: "Detailed description" }));
    store.insertNode(makeNode({ type: "requirement", title: "Req 1", description: "Details" }));
    store.insertNode(makeNode({ type: "task", title: "Task 1", acceptanceCriteria: ["AC1"], xpSize: "M" }));
    store.insertNode(makeNode({ type: "task", title: "Task 2", acceptanceCriteria: ["AC2"], estimateMinutes: 60 }));
    store.insertNode(makeNode({ type: "risk", title: "Risk 1" }));
    store.insertNode(makeNode({ type: "constraint", title: "Constraint 1" }));

    const doc = store.toGraphDocument();
    const report = analyzePrdQuality(doc);

    expect(report.score).toBeGreaterThanOrEqual(60);
    expect(report.readyForDesign).toBe(true);
    expect(["A", "B", "C"]).toContain(report.grade);
  });

  it("should not be ready for design when requirements are missing", () => {
    store.insertNode(makeNode({ type: "task", title: "Task 1" }));

    const doc = store.toGraphDocument();
    const report = analyzePrdQuality(doc);

    expect(report.readyForDesign).toBe(false);
  });

  it("should provide suggestions for weak sections", () => {
    store.insertNode(makeNode({ type: "epic", title: "Epic without description" }));

    const doc = store.toGraphDocument();
    const report = analyzePrdQuality(doc);

    const allSuggestions = report.sections.flatMap((s) => s.suggestions);
    expect(allSuggestions.length).toBeGreaterThan(0);
  });
});
