import { describe, it, expect } from "vitest";
import { validateAdrs } from "../../core/designer/adr-validator.js";
import type { GraphDocument, GraphNode, GraphEdge } from "../../core/graph/graph-types.js";

function makeDoc(
  nodes: Partial<GraphNode>[] = [],
  edges: Partial<GraphEdge>[] = [],
): GraphDocument {
  const fullNodes: GraphNode[] = nodes.map((n, i) => ({
    id: n.id ?? `node_${i}`,
    type: n.type ?? "task",
    title: n.title ?? `Node ${i}`,
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

describe("validateAdrs", () => {
  it("should return empty report when no decision nodes exist", () => {
    const doc = makeDoc([{ type: "epic" }, { type: "requirement" }]);
    const report = validateAdrs(doc);
    expect(report.decisions).toHaveLength(0);
    expect(report.overallGrade).toBe("F");
    expect(report.summary).toContain("0");
  });

  it("should grade A when decision has all 4 ADR sections", () => {
    const doc = makeDoc([{
      type: "decision",
      title: "Use PostgreSQL",
      description: "## Status\nAccepted\n## Context\nNeed a database\n## Decision\nUse PostgreSQL\n## Consequences\nNeed DBA skills",
    }]);
    const report = validateAdrs(doc);
    expect(report.decisions).toHaveLength(1);
    expect(report.decisions[0].grade).toBe("A");
    expect(report.decisions[0].hasStatus).toBe(true);
    expect(report.decisions[0].hasContext).toBe(true);
    expect(report.decisions[0].hasDecision).toBe(true);
    expect(report.decisions[0].hasConsequences).toBe(true);
    expect(report.decisions[0].missingFields).toHaveLength(0);
    expect(report.overallGrade).toBe("A");
  });

  it("should grade B when decision has 3 ADR sections", () => {
    const doc = makeDoc([{
      type: "decision",
      title: "Use React",
      description: "## Status\nAccepted\n## Context\nNeed UI framework\n## Decision\nUse React",
    }]);
    const report = validateAdrs(doc);
    expect(report.decisions[0].grade).toBe("B");
    expect(report.decisions[0].missingFields).toContain("Consequences");
  });

  it("should grade C when decision has 2 ADR sections", () => {
    const doc = makeDoc([{
      type: "decision",
      title: "Use TypeScript",
      description: "## Context\nNeed type safety\n## Decision\nUse TypeScript",
    }]);
    const report = validateAdrs(doc);
    expect(report.decisions[0].grade).toBe("C");
    expect(report.decisions[0].missingFields).toHaveLength(2);
  });

  it("should grade D when decision has 1 ADR section", () => {
    const doc = makeDoc([{
      type: "decision",
      title: "Use ESM",
      description: "## Decision\nUse ESM modules only",
    }]);
    const report = validateAdrs(doc);
    expect(report.decisions[0].grade).toBe("D");
  });

  it("should grade F when decision has no ADR sections", () => {
    const doc = makeDoc([{
      type: "decision",
      title: "Use Vitest",
      description: "We should use Vitest for testing",
    }]);
    const report = validateAdrs(doc);
    expect(report.decisions[0].grade).toBe("F");
    expect(report.decisions[0].missingFields).toHaveLength(4);
  });

  it("should support case-insensitive section headings", () => {
    const doc = makeDoc([{
      type: "decision",
      title: "Auth",
      description: "## status\naccepted\n## context\nauth needed\n## decision\nJWT\n## consequences\ntoken mgmt",
    }]);
    const report = validateAdrs(doc);
    expect(report.decisions[0].grade).toBe("A");
  });

  it("should support 'Heading:' format without ##", () => {
    const doc = makeDoc([{
      type: "decision",
      title: "DB choice",
      description: "Status: Accepted\nContext: Need storage\nDecision: Use SQLite\nConsequences: Single file",
    }]);
    const report = validateAdrs(doc);
    expect(report.decisions[0].grade).toBe("A");
  });

  it("should use strictest grade as overall when multiple decisions", () => {
    const doc = makeDoc([
      {
        type: "decision",
        title: "Good ADR",
        description: "## Status\nAccepted\n## Context\nX\n## Decision\nY\n## Consequences\nZ",
      },
      {
        type: "decision",
        title: "Bad ADR",
        description: "No sections here",
      },
    ]);
    const report = validateAdrs(doc);
    expect(report.decisions).toHaveLength(2);
    expect(report.overallGrade).toBe("F");
  });

  it("should handle decisions without description", () => {
    const doc = makeDoc([{ type: "decision", title: "Empty decision" }]);
    const report = validateAdrs(doc);
    expect(report.decisions[0].grade).toBe("F");
    expect(report.decisions[0].missingFields).toHaveLength(4);
  });

  it("should only process decision nodes, ignoring other types", () => {
    const doc = makeDoc([
      { type: "epic", description: "## Status\nActive" },
      { type: "decision", title: "Real ADR", description: "## Status\nAccepted\n## Context\nX\n## Decision\nY\n## Consequences\nZ" },
      { type: "risk", description: "## Status\nActive" },
    ]);
    const report = validateAdrs(doc);
    expect(report.decisions).toHaveLength(1);
    expect(report.decisions[0].grade).toBe("A");
  });
});
