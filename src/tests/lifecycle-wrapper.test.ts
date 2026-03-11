import { describe, it, expect } from "vitest";
import { buildLifecycleBlock } from "../mcp/lifecycle-wrapper.js";
import type { GraphDocument } from "../core/graph/graph-types.js";

function makeDoc(nodes: Array<{ type: string; status: string; sprint?: string | null }> = []): GraphDocument {
  return {
    version: "1.0",
    project: { id: "proj_1", name: "test", createdAt: "2025-01-01T00:00:00Z", updatedAt: "2025-01-01T00:00:00Z" },
    nodes: nodes.map((n, i) => ({
      id: `node_${i}`,
      type: n.type,
      title: `Node ${i}`,
      status: n.status,
      priority: 3 as const,
      sprint: n.sprint ?? null,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    })),
    edges: [],
    indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
    meta: { sourceFiles: [], lastImport: null },
  } as unknown as GraphDocument;
}

describe("buildLifecycleBlock", () => {
  it("should return a lifecycle block with phase info", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress", sprint: "s1" }]);
    const block = buildLifecycleBlock(doc);

    expect(block.phase).toBe("IMPLEMENT");
    expect(block.reminder).toBeTruthy();
    expect(block.suggestedNext).toBeInstanceOf(Array);
    expect(block.suggestedNext.length).toBeGreaterThan(0);
    expect(block.principles).toBeInstanceOf(Array);
  });

  it("should return ANALYZE phase for empty graph", () => {
    const doc = makeDoc();
    const block = buildLifecycleBlock(doc);

    expect(block.phase).toBe("ANALYZE");
  });

  it("should include all required fields", () => {
    const doc = makeDoc([{ type: "task", status: "backlog" }]);
    const block = buildLifecycleBlock(doc);

    expect(block).toHaveProperty("phase");
    expect(block).toHaveProperty("reminder");
    expect(block).toHaveProperty("suggestedNext");
    expect(block).toHaveProperty("principles");
  });
});
