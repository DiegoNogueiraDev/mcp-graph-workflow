import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { checkDefinitionOfReady } from "../core/analyzer/definition-of-ready.js";
import { makeNode } from "./helpers/factories.js";

describe("checkDefinitionOfReady", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Ready Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should fail readiness for empty graph", () => {
    const doc = store.toGraphDocument();
    const report = checkDefinitionOfReady(doc);

    expect(report.readyForNextPhase).toBe(false);
    expect(report.blockers.length).toBeGreaterThan(0);
  });

  it("should check has_requirements", () => {
    const doc = store.toGraphDocument();
    const report = checkDefinitionOfReady(doc);

    const check = report.checks.find((c) => c.name === "has_requirements");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
  });

  it("should pass has_requirements when epic exists", () => {
    store.insertNode(makeNode({ type: "epic", title: "Epic" }));

    const doc = store.toGraphDocument();
    const report = checkDefinitionOfReady(doc);

    const check = report.checks.find((c) => c.name === "has_requirements");
    expect(check!.passed).toBe(true);
  });

  it("should check for risks and constraints", () => {
    store.insertNode(makeNode({ type: "epic", title: "Epic" }));

    const doc = store.toGraphDocument();
    const report = checkDefinitionOfReady(doc);

    const risksCheck = report.checks.find((c) => c.name === "has_risks");
    const constraintsCheck = report.checks.find((c) => c.name === "has_constraints");
    expect(risksCheck!.passed).toBe(false);
    expect(constraintsCheck!.passed).toBe(false);
  });

  it("should pass more checks with complete graph", () => {
    store.insertNode(makeNode({ type: "epic", title: "Epic", description: "Detailed" }));
    store.insertNode(makeNode({ type: "requirement", title: "Req", description: "Details" }));
    store.insertNode(makeNode({ type: "risk", title: "Risk 1" }));
    store.insertNode(makeNode({ type: "constraint", title: "Constraint 1" }));
    store.insertNode(makeNode({ type: "task", title: "Task 1", acceptanceCriteria: ["AC1"], xpSize: "M" }));

    const doc = store.toGraphDocument();
    const report = checkDefinitionOfReady(doc);

    const passed = report.checks.filter((c) => c.passed).length;
    expect(passed).toBeGreaterThanOrEqual(4);
  });
});
