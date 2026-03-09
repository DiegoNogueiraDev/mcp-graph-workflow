import { describe, it, expect } from "vitest";
import { findNextTask } from "../core/planner/next-task.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../core/graph/graph-types.js";
import {
  makeNode,
  makeEdge,
  makeTask,
  makeDoneTask,
  makeBlockedTask,
  makeSubtask,
} from "./helpers/factories.js";

function makeDoc(nodes: GraphNode[], edges: GraphEdge[] = []): GraphDocument {
  return {
    version: "1.0.0",
    project: {
      id: "test",
      name: "Test",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
    meta: { sourceFiles: [], lastImport: null },
    nodes,
    edges,
    indexes: {
      byId: {},
      childrenByParent: {},
      incomingByNode: {},
      outgoingByNode: {},
    },
  };
}

describe("findNextTask", () => {
  // ── Filtragem ──────────────────────────────────────────────

  it("retorna null quando não há nodes", () => {
    const doc = makeDoc([]);
    const result = findNextTask(doc);
    expect(result).toBeNull();
  });

  it("retorna null quando todas as tasks estão done", () => {
    const doc = makeDoc([
      makeDoneTask({ id: "t1" }),
      makeDoneTask({ id: "t2" }),
    ]);
    const result = findNextTask(doc);
    expect(result).toBeNull();
  });

  it("ignora nodes que não são task/subtask", () => {
    const doc = makeDoc([
      makeNode({ id: "e1", type: "epic", status: "backlog" }),
      makeNode({ id: "r1", type: "requirement", status: "backlog" }),
      makeNode({ id: "c1", type: "constraint", status: "backlog" }),
    ]);
    const result = findNextTask(doc);
    expect(result).toBeNull();
  });

  it("ignora nodes com status in_progress ou done", () => {
    const doc = makeDoc([
      makeTask({ id: "t1", status: "in_progress" }),
      makeDoneTask({ id: "t2" }),
    ]);
    const result = findNextTask(doc);
    expect(result).toBeNull();
  });

  it("ignora nodes com blocked=true", () => {
    const doc = makeDoc([
      makeBlockedTask({ id: "t1", status: "backlog" }),
      makeBlockedTask({ id: "t2", status: "ready" }),
    ]);
    const result = findNextTask(doc);
    expect(result).toBeNull();
  });

  // ── Resolução de dependências ──────────────────────────────

  it("filtra tasks com depends_on para nodes não-done", () => {
    const blocked = makeTask({ id: "t1" });
    const dep = makeTask({ id: "dep1", status: "in_progress" });
    const free = makeTask({ id: "t2" });
    const edge = makeEdge("t1", "dep1", { relationType: "depends_on" });

    const doc = makeDoc([blocked, dep, free], [edge]);
    const result = findNextTask(doc);

    expect(result).not.toBeNull();
    expect(result!.node.id).toBe("t2");
  });

  it("permite tasks cujas dependências estão todas done", () => {
    const task = makeTask({ id: "t1" });
    const done = makeDoneTask({ id: "dep1" });
    const edge = makeEdge("t1", "dep1", { relationType: "depends_on" });

    const doc = makeDoc([task, done], [edge]);
    const result = findNextTask(doc);

    expect(result).not.toBeNull();
    expect(result!.node.id).toBe("t1");
  });

  it("quando todas têm deps pendentes retorna a com menos deps", () => {
    const dep1 = makeTask({ id: "dep1", status: "in_progress" });
    const dep2 = makeTask({ id: "dep2", status: "in_progress" });
    const dep3 = makeTask({ id: "dep3", status: "in_progress" });

    // t1 has 1 pending dep, t2 has 2 pending deps
    const t1 = makeTask({ id: "t1" });
    const t2 = makeTask({ id: "t2" });

    const edges = [
      makeEdge("t1", "dep1", { relationType: "depends_on" }),
      makeEdge("t2", "dep2", { relationType: "depends_on" }),
      makeEdge("t2", "dep3", { relationType: "depends_on" }),
    ];

    const doc = makeDoc([t1, t2, dep1, dep2, dep3], edges);
    const result = findNextTask(doc);

    expect(result).not.toBeNull();
    expect(result!.node.id).toBe("t1");
    expect(result!.reason).toBe(
      "Todas as tasks têm dependências pendentes. Esta tem menos (1).",
    );
  });

  // ── Sorting multi-critério ─────────────────────────────────

  it("ordena por priority ASC", () => {
    const high = makeTask({
      id: "t-high",
      priority: 1,
      createdAt: "2024-01-02T00:00:00Z",
    });
    const low = makeTask({
      id: "t-low",
      priority: 3,
      createdAt: "2024-01-01T00:00:00Z",
    });

    const doc = makeDoc([low, high]);
    const result = findNextTask(doc);

    expect(result!.node.id).toBe("t-high");
  });

  it("desempata priority por xpSize ASC", () => {
    const small = makeTask({
      id: "t-xs",
      priority: 3,
      xpSize: "XS",
      createdAt: "2024-01-02T00:00:00Z",
    });
    const medium = makeTask({
      id: "t-m",
      priority: 3,
      xpSize: "M",
      createdAt: "2024-01-01T00:00:00Z",
    });

    const doc = makeDoc([medium, small]);
    const result = findNextTask(doc);

    expect(result!.node.id).toBe("t-xs");
  });

  it("desempata xpSize por estimateMinutes ASC", () => {
    const quick = makeTask({
      id: "t-quick",
      priority: 3,
      xpSize: "M",
      estimateMinutes: 30,
      createdAt: "2024-01-02T00:00:00Z",
    });
    const slow = makeTask({
      id: "t-slow",
      priority: 3,
      xpSize: "M",
      estimateMinutes: 120,
      createdAt: "2024-01-01T00:00:00Z",
    });

    const doc = makeDoc([slow, quick]);
    const result = findNextTask(doc);

    expect(result!.node.id).toBe("t-quick");
  });

  it("desempata estimate por acceptanceCriteria count DESC", () => {
    const moreAC = makeTask({
      id: "t-more-ac",
      priority: 3,
      xpSize: "M",
      estimateMinutes: 60,
      acceptanceCriteria: ["AC1", "AC2", "AC3"],
      createdAt: "2024-01-02T00:00:00Z",
    });
    const lessAC = makeTask({
      id: "t-less-ac",
      priority: 3,
      xpSize: "M",
      estimateMinutes: 60,
      acceptanceCriteria: ["AC1"],
      createdAt: "2024-01-01T00:00:00Z",
    });

    const doc = makeDoc([lessAC, moreAC]);
    const result = findNextTask(doc);

    expect(result!.node.id).toBe("t-more-ac");
  });

  it("desempata AC por createdAt ASC", () => {
    const older = makeTask({
      id: "t-older",
      priority: 3,
      xpSize: "M",
      estimateMinutes: 60,
      acceptanceCriteria: ["AC1"],
      createdAt: "2024-01-01T00:00:00Z",
    });
    const newer = makeTask({
      id: "t-newer",
      priority: 3,
      xpSize: "M",
      estimateMinutes: 60,
      acceptanceCriteria: ["AC1"],
      createdAt: "2024-01-02T00:00:00Z",
    });

    const doc = makeDoc([newer, older]);
    const result = findNextTask(doc);

    expect(result!.node.id).toBe("t-older");
  });

  // ── Reason string ──────────────────────────────────────────

  it("reason inclui alta prioridade para priority 1-2", () => {
    const p1 = makeTask({ id: "t1", priority: 1 });
    const p2 = makeTask({ id: "t2", priority: 2 });

    const doc1 = makeDoc([p1]);
    const result1 = findNextTask(doc1);
    expect(result1!.reason).toContain("alta prioridade");

    const doc2 = makeDoc([p2]);
    const result2 = findNextTask(doc2);
    expect(result2!.reason).toContain("alta prioridade");
  });

  it("reason inclui baixa complexidade para XS/S", () => {
    const xs = makeTask({ id: "t-xs", xpSize: "XS" });
    const s = makeTask({ id: "t-s", xpSize: "S" });

    const docXS = makeDoc([xs]);
    const resultXS = findNextTask(docXS);
    expect(resultXS!.reason).toContain("baixa complexidade");

    const docS = makeDoc([s]);
    const resultS = findNextTask(docS);
    expect(resultS!.reason).toContain("baixa complexidade");
  });

  // ── priority_over edges ─────────────────────────────────────

  it("priority_over edge makes task rank first even at same priority", () => {
    const taskA = makeTask({ id: "t-a", priority: 3, createdAt: "2024-01-02T00:00:00Z" });
    const taskB = makeTask({ id: "t-b", priority: 3, createdAt: "2024-01-01T00:00:00Z" });
    // A has priority_over B, so A should come first even though B is older
    const edge = makeEdge("t-a", "t-b", { relationType: "priority_over" });

    const doc = makeDoc([taskA, taskB], [edge]);
    const result = findNextTask(doc);
    expect(result!.node.id).toBe("t-a");
  });

  it("priority_over is transitive: A > B > C means A first", () => {
    const taskA = makeTask({ id: "t-a", priority: 3, createdAt: "2024-01-03T00:00:00Z" });
    const taskB = makeTask({ id: "t-b", priority: 3, createdAt: "2024-01-02T00:00:00Z" });
    const taskC = makeTask({ id: "t-c", priority: 3, createdAt: "2024-01-01T00:00:00Z" });
    const edges = [
      makeEdge("t-a", "t-b", { relationType: "priority_over" }),
      makeEdge("t-b", "t-c", { relationType: "priority_over" }),
    ];

    const doc = makeDoc([taskC, taskB, taskA], edges);
    const result = findNextTask(doc);
    expect(result!.node.id).toBe("t-a");
  });

  it("priority_over cycles are handled gracefully (no crash)", () => {
    const taskA = makeTask({ id: "t-a", priority: 3 });
    const taskB = makeTask({ id: "t-b", priority: 3 });
    const edges = [
      makeEdge("t-a", "t-b", { relationType: "priority_over" }),
      makeEdge("t-b", "t-a", { relationType: "priority_over" }),
    ];

    const doc = makeDoc([taskA, taskB], edges);
    // Should not throw, should return one of them
    const result = findNextTask(doc);
    expect(result).not.toBeNull();
  });

  it("priority_over only affects unblocked tasks in the candidate set", () => {
    const taskA = makeTask({ id: "t-a", priority: 3 });
    const taskB = makeTask({ id: "t-b", priority: 3 });
    const dep = makeTask({ id: "dep", status: "in_progress" });
    // A has priority_over B, but A has an unresolved dependency
    const edges = [
      makeEdge("t-a", "t-b", { relationType: "priority_over" }),
      makeEdge("t-a", "dep", { relationType: "depends_on" }),
    ];

    const doc = makeDoc([taskA, taskB, dep], edges);
    const result = findNextTask(doc);
    expect(result!.node.id).toBe("t-b");
  });
});
