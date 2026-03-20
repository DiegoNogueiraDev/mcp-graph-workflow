import { describe, it, expect } from "vitest";
import { graphToMermaid } from "../core/graph/mermaid-export.js";
import type { GraphNode, GraphEdge } from "../core/graph/graph-types.js";

/**
 * BUG-21: JSON export ignores filterType/filterStatus.
 * Also BUG-25: Mermaid escapeMermaid uses #amp; instead of &amp;.
 * Also BUG-26: Mermaid shows duplicate edges.
 *
 * We test mermaid-export's filterNodes (exported), escapeMermaid fix,
 * and edge deduplication here.
 */

function makeNode(overrides: Partial<GraphNode> & { id: string; title: string }): GraphNode {
  return {
    type: "task",
    status: "ready",
    priority: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeEdge(from: string, to: string, relationType: string): GraphEdge {
  return {
    id: `${from}-${to}`,
    from,
    to,
    relationType: relationType as GraphEdge["relationType"],
    createdAt: new Date().toISOString(),
  };
}

describe("BUG-25: escapeMermaid ampersand fix", () => {
  it("should encode & as &amp; not #amp;", () => {
    const nodes = [makeNode({ id: "n1", title: "A & B" })];
    const result = graphToMermaid(nodes, [], {});
    expect(result).toContain("&amp;");
    expect(result).not.toContain("#amp;");
  });

  it("should encode all special chars properly", () => {
    const nodes = [makeNode({ id: "n1", title: 'A < B > C & D "E"' })];
    const result = graphToMermaid(nodes, [], {});
    expect(result).toContain("&amp;");
    expect(result).toContain("&lt;");
    expect(result).toContain("&gt;");
    expect(result).toContain("&quot;");
  });
});

describe("BUG-26: Mermaid duplicate edge deduplication", () => {
  it("should not render child_of edges (redundant with parent_of)", () => {
    const nodes = [
      makeNode({ id: "a", title: "A" }),
      makeNode({ id: "b", title: "B" }),
    ];
    const edges = [
      makeEdge("a", "b", "parent_of"),
      makeEdge("b", "a", "child_of"),
    ];
    const result = graphToMermaid(nodes, edges, {});
    const edgeLines = result.split("\n").filter((l) => l.includes("-->") || l.includes("-.->"));
    expect(edgeLines).toHaveLength(1);
    expect(edgeLines[0]).toContain("parent_of");
  });

  it("should render non-redundant edges normally", () => {
    const nodes = [
      makeNode({ id: "a", title: "A" }),
      makeNode({ id: "b", title: "B" }),
    ];
    const edges = [makeEdge("a", "b", "depends_on")];
    const result = graphToMermaid(nodes, edges, {});
    const edgeLines = result.split("\n").filter((l) => l.includes("-.->"));
    expect(edgeLines).toHaveLength(1);
  });

  it("should deduplicate identical edges", () => {
    const nodes = [
      makeNode({ id: "a", title: "A" }),
      makeNode({ id: "b", title: "B" }),
    ];
    const edges = [
      makeEdge("a", "b", "depends_on"),
      makeEdge("a", "b", "depends_on"),
    ];
    const result = graphToMermaid(nodes, edges, {});
    const edgeLines = result.split("\n").filter((l) => l.includes("-.->"));
    expect(edgeLines).toHaveLength(1);
  });
});

describe("BUG-21: filterNodes export for JSON", () => {
  it("filterNodes should be importable from mermaid-export", async () => {
    const { filterNodes } = await import("../core/graph/mermaid-export.js");
    expect(typeof filterNodes).toBe("function");
  });

  it("should filter nodes by type", async () => {
    const { filterNodes } = await import("../core/graph/mermaid-export.js");
    const nodes = [
      makeNode({ id: "t1", title: "Task", type: "task" }),
      makeNode({ id: "e1", title: "Epic", type: "epic" }),
      makeNode({ id: "t2", title: "Task 2", type: "task" }),
    ];
    const filtered = filterNodes(nodes, { filterType: ["task"] });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((n) => n.type === "task")).toBe(true);
  });

  it("should filter nodes by status", async () => {
    const { filterNodes } = await import("../core/graph/mermaid-export.js");
    const nodes = [
      makeNode({ id: "t1", title: "Done", status: "done" }),
      makeNode({ id: "t2", title: "Ready", status: "ready" }),
    ];
    const filtered = filterNodes(nodes, { filterStatus: ["done"] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].status).toBe("done");
  });
});
