import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { assessRisks } from "../core/analyzer/risk-assessment.js";
import { makeNode } from "./helpers/factories.js";

describe("assessRisks", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Risk Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should return empty risks for graph without risk nodes", () => {
    store.insertNode(makeNode({ type: "task", title: "Task" }));

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks).toHaveLength(0);
    expect(result.summary.total).toBe(0);
  });

  it("should assess risk nodes with default scoring", () => {
    store.insertNode(makeNode({ type: "risk", title: "Generic risk" }));

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks).toHaveLength(1);
    expect(result.risks[0].probability).toBe(3);
    expect(result.risks[0].impact).toBe(3);
    expect(result.risks[0].score).toBe(9);
    expect(result.risks[0].level).toBe("high");
  });

  it("should score higher probability for high-probability keywords", () => {
    store.insertNode(makeNode({ type: "risk", title: "Likely failure in auth" }));

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks[0].probability).toBe(4);
  });

  it("should score higher impact for critical keywords", () => {
    store.insertNode(makeNode({ type: "risk", title: "Potential data loss" }));

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks[0].impact).toBe(4);
  });

  it("should mark risk as mitigated when child task is done", () => {
    const risk = makeNode({ type: "risk", title: "Security risk" });
    const mitigation = makeNode({ type: "task", title: "Security audit", parentId: risk.id, status: "done" });
    store.insertNode(risk);
    store.insertNode(mitigation);

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks[0].mitigationStatus).toBe("mitigated");
    expect(result.summary.mitigated).toBe(1);
  });

  it("should mark risk as partial when child task is in_progress", () => {
    const risk = makeNode({ type: "risk", title: "Performance risk" });
    const mitigation = makeNode({ type: "task", title: "Perf benchmark", parentId: risk.id, status: "in_progress" });
    store.insertNode(risk);
    store.insertNode(mitigation);

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks[0].mitigationStatus).toBe("partial");
  });

  it("should suggest mitigation for unmitigated risks", () => {
    store.insertNode(makeNode({ type: "risk", title: "Security vulnerability" }));

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks[0].suggestedMitigation).toBeDefined();
    expect(result.risks[0].suggestedMitigation).toContain("security");
  });

  it("should sort risks by score descending", () => {
    store.insertNode(makeNode({ type: "risk", title: "Minor cosmetic issue" }));
    store.insertNode(makeNode({ type: "risk", title: "Critical security breach likely" }));

    const doc = store.toGraphDocument();
    const result = assessRisks(doc);

    expect(result.risks[0].score).toBeGreaterThanOrEqual(result.risks[1].score);
  });
});
