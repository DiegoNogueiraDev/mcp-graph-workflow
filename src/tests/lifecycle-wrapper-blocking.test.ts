import { describe, it, expect } from "vitest";
import { buildLifecycleBlock, type LifecycleBlockOptions } from "../mcp/lifecycle-wrapper.js";
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

describe("buildLifecycleBlock with strict mode", () => {
  it("should include error warnings in strict mode for blocked tools", () => {
    const doc = makeDoc();
    const options: LifecycleBlockOptions = {
      toolName: "update_status",
      mode: "strict",
    };
    const block = buildLifecycleBlock(doc, options);

    expect(block.phase).toBe("ANALYZE");
    expect(block.warnings.some((w) => w.severity === "error")).toBe(true);
    expect(block.warnings.some((w) => w.code === "tool_phase_blocked")).toBe(true);
  });

  it("should include only warning severity in advisory mode", () => {
    const doc = makeDoc();
    const options: LifecycleBlockOptions = {
      toolName: "update_status",
      mode: "advisory",
    };
    const block = buildLifecycleBlock(doc, options);

    expect(block.phase).toBe("ANALYZE");
    expect(block.warnings.some((w) => w.severity === "error")).toBe(false);
    expect(block.warnings.some((w) => w.code === "tool_phase_blocked")).toBe(true);
    expect(block.warnings.find((w) => w.code === "tool_phase_blocked")!.severity).toBe("warning");
  });

  it("should not include gate warnings for allowed tools in strict mode", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress", sprint: "s1" }]);
    const options: LifecycleBlockOptions = {
      toolName: "next",
      mode: "strict",
    };
    const block = buildLifecycleBlock(doc, options);

    expect(block.phase).toBe("IMPLEMENT");
    expect(block.warnings.some((w) => w.code === "tool_phase_blocked")).toBe(false);
  });

  it("should not gate always-allowed tools even in strict mode", () => {
    const doc = makeDoc();
    const alwaysAllowed = ["list", "show", "search", "stats", "export", "init", "set_phase"];
    for (const tool of alwaysAllowed) {
      const block = buildLifecycleBlock(doc, { toolName: tool, mode: "strict" });
      expect(block.warnings.some((w) => w.code === "tool_phase_blocked")).toBe(false);
    }
  });

  it("should block validate_task in DESIGN strict mode", () => {
    const doc = makeDoc([
      { type: "requirement", status: "backlog" },
      { type: "decision", status: "backlog" },
    ]);
    const block = buildLifecycleBlock(doc, { toolName: "validate_task", mode: "strict" });

    expect(block.phase).toBe("DESIGN");
    expect(block.warnings.some((w) => w.severity === "error" && w.code === "tool_phase_blocked")).toBe(true);
  });

  it("should allow validate_task in IMPLEMENT strict mode", () => {
    const doc = makeDoc([
      { type: "task", status: "in_progress", sprint: "s1" },
    ]);
    const block = buildLifecycleBlock(doc, { toolName: "validate_task", mode: "strict" });

    expect(block.phase).toBe("IMPLEMENT");
    expect(block.warnings.some((w) => w.code === "tool_phase_blocked")).toBe(false);
  });

  it("should default to strict mode when mode is not provided", () => {
    const doc = makeDoc();
    const block = buildLifecycleBlock(doc, { toolName: "update_status" });

    // Has error severity — strict mode is default
    expect(block.warnings.some((w) => w.severity === "error")).toBe(true);
  });

  it("should include premature_status_change as error in strict mode for ANALYZE phase", () => {
    const doc = makeDoc();
    const block = buildLifecycleBlock(doc, { toolName: "update_status", mode: "strict" });

    const premature = block.warnings.find((w) => w.code === "premature_status_change");
    expect(premature).toBeDefined();
    expect(premature!.severity).toBe("error");
  });
});
