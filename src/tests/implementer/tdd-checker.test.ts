import { describe, it, expect } from "vitest";
import { checkTddAdherence, generateTddHints } from "../../core/implementer/tdd-checker.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../../core/graph/graph-types.js";

function makeDoc(
  nodes: Partial<GraphNode>[] = [],
  edges: Partial<GraphEdge>[] = [],
): GraphDocument {
  const fullNodes: GraphNode[] = nodes.map((n, i) => ({
    id: n.id ?? `node_${i}`,
    type: n.type ?? "task",
    title: n.title ?? `Task ${i}`,
    status: n.status ?? "backlog",
    priority: n.priority ?? 3,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...n,
  })) as GraphNode[];

  const fullEdges: GraphEdge[] = edges.map((e, i) => ({
    id: e.id ?? `edge_${i}`,
    from: e.from ?? "",
    to: e.to ?? "",
    relationType: e.relationType ?? "depends_on",
    createdAt: "2025-01-01T00:00:00Z",
    ...e,
  })) as GraphEdge[];

  return {
    version: "1.0",
    project: { id: "proj_1", name: "test", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z" },
    nodes: fullNodes,
    edges: fullEdges,
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  };
}

describe("checkTddAdherence", () => {
  it("should return empty report when no tasks have AC", () => {
    const doc = makeDoc([
      { id: "t1", type: "task" },
    ]);
    const report = checkTddAdherence(doc);
    expect(report.tasks).toHaveLength(0);
    expect(report.overallTestability).toBe(0);
    expect(report.tasksAtRisk).toBe(0);
  });

  it("should analyze tasks with AC", () => {
    const doc = makeDoc([
      {
        id: "t1", type: "task",
        acceptanceCriteria: ["Should return 200 on valid request"],
      },
    ]);
    const report = checkTddAdherence(doc);
    expect(report.tasks).toHaveLength(1);
    expect(report.tasks[0].nodeId).toBe("t1");
    expect(report.tasks[0].totalAcs).toBe(1);
  });

  it("should count testable and measurable ACs", () => {
    const doc = makeDoc([
      {
        id: "t1", type: "task",
        acceptanceCriteria: [
          "Given valid input, When submitted, Then should save to DB",
          "Make it nice and good",
        ],
      },
    ]);
    const report = checkTddAdherence(doc);
    expect(report.tasks[0].testableAcs).toBe(1);
    expect(report.tasks[0].totalAcs).toBe(2);
  });

  it("should calculate testability score per task", () => {
    const doc = makeDoc([
      {
        id: "t1", type: "task",
        acceptanceCriteria: [
          "Should return status 200",
          "Should validate input",
        ],
      },
    ]);
    const report = checkTddAdherence(doc);
    expect(report.tasks[0].testabilityScore).toBe(100);
  });

  it("should identify tasks at risk (0 testable ACs)", () => {
    const doc = makeDoc([
      {
        id: "t1", type: "task",
        acceptanceCriteria: ["Make it better", "Improve quality"],
      },
    ]);
    const report = checkTddAdherence(doc);
    expect(report.tasksAtRisk).toBe(1);
    expect(report.tasks[0].testabilityScore).toBe(0);
  });

  it("should generate suggested test specs for GWT ACs", () => {
    const doc = makeDoc([
      {
        id: "t1", type: "task",
        acceptanceCriteria: [
          "Given a logged-in user\nWhen they click logout\nThen should redirect to login page",
        ],
      },
    ]);
    const report = checkTddAdherence(doc);
    expect(report.suggestedTestSpecs.length).toBeGreaterThan(0);
    expect(report.suggestedTestSpecs[0].testName).toContain("should");
  });

  it("should suggest unit test for return/status keywords", () => {
    const doc = makeDoc([
      {
        id: "t1", type: "task",
        acceptanceCriteria: ["Should return a valid JSON response"],
      },
    ]);
    const report = checkTddAdherence(doc);
    const spec = report.suggestedTestSpecs.find((s) => s.fromAc.includes("return"));
    expect(spec).toBeDefined();
    expect(spec!.type).toBe("unit");
  });

  it("should suggest integration test for persist/save keywords", () => {
    const doc = makeDoc([
      {
        id: "t1", type: "task",
        acceptanceCriteria: ["Should save the record to database"],
      },
    ]);
    const report = checkTddAdherence(doc);
    const spec = report.suggestedTestSpecs.find((s) => s.fromAc.includes("save"));
    expect(spec).toBeDefined();
    expect(spec!.type).toBe("integration");
  });

  it("should suggest e2e test for navigation/display keywords", () => {
    const doc = makeDoc([
      {
        id: "t1", type: "task",
        acceptanceCriteria: ["Should navigate to the dashboard page"],
      },
    ]);
    const report = checkTddAdherence(doc);
    const spec = report.suggestedTestSpecs.find((s) => s.fromAc.includes("navigate"));
    expect(spec).toBeDefined();
    expect(spec!.type).toBe("e2e");
  });

  it("should calculate overall testability across all tasks", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", acceptanceCriteria: ["Should return 200"] },
      { id: "t2", type: "task", acceptanceCriteria: ["Make it nice"] },
    ]);
    const report = checkTddAdherence(doc);
    expect(report.overallTestability).toBe(50);
  });

  it("should filter by nodeId when provided", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", acceptanceCriteria: ["Should return 200"] },
      { id: "t2", type: "task", acceptanceCriteria: ["Should validate input"] },
    ]);
    const report = checkTddAdherence(doc, "t1");
    expect(report.tasks).toHaveLength(1);
    expect(report.tasks[0].nodeId).toBe("t1");
  });

  it("should include summary string", () => {
    const doc = makeDoc([
      { id: "t1", type: "task", acceptanceCriteria: ["Should return 200"] },
    ]);
    const report = checkTddAdherence(doc);
    expect(report.summary).toBeTruthy();
    expect(typeof report.summary).toBe("string");
  });
});

describe("generateTddHints", () => {
  it("should generate hints for a node with ACs", () => {
    const node: GraphNode = {
      id: "t1", type: "task", title: "Test", status: "backlog",
      priority: 3, createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z",
      acceptanceCriteria: ["Given a user\nWhen login\nThen should redirect to home"],
    };
    const hints = generateTddHints(node);
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0].testName).toBeTruthy();
    expect(hints[0].type).toBeTruthy();
  });

  it("should return empty array for node without ACs", () => {
    const node: GraphNode = {
      id: "t1", type: "task", title: "Test", status: "backlog",
      priority: 3, createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z",
    };
    const hints = generateTddHints(node);
    expect(hints).toHaveLength(0);
  });
});
