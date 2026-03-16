import { describe, it, expect } from "vitest";
import { buildLifecycleBlock } from "../mcp/lifecycle-wrapper.js";
import { detectWarnings } from "../core/planner/lifecycle-phase.js";
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

  it("should include all required fields including warnings", () => {
    const doc = makeDoc([{ type: "task", status: "backlog" }]);
    const block = buildLifecycleBlock(doc);

    expect(block).toHaveProperty("phase");
    expect(block).toHaveProperty("reminder");
    expect(block).toHaveProperty("suggestedNext");
    expect(block).toHaveProperty("principles");
    expect(block).toHaveProperty("warnings");
    expect(block.warnings).toBeInstanceOf(Array);
  });
});

describe("detectWarnings", () => {
  it("should warn when update_status is called in ANALYZE phase", () => {
    const doc = makeDoc();
    const warnings = detectWarnings(doc, "ANALYZE", "update_status");

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.code === "premature_status_change")).toBe(true);
    const prematureWarning = warnings.find((w) => w.code === "premature_status_change")!;
    expect(prematureWarning.severity).toBe("warning");
  });

  it("should warn when update_status is called in PLAN without sprint", () => {
    const doc = makeDoc([
      { type: "task", status: "backlog" },
    ]);
    const warnings = detectWarnings(doc, "PLAN", "update_status");

    expect(warnings.some((w) => w.code === "no_sprint_assigned")).toBe(true);
  });

  it("should emit info when tool is not in suggestedTools for current phase", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress", sprint: "s1" }]);
    const warnings = detectWarnings(doc, "IMPLEMENT", "export");

    expect(warnings.some((w) => w.code === "tool_not_recommended" && w.severity === "info")).toBe(true);
  });

  it("should return empty warnings when workflow is correct", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress", sprint: "s1" }]);
    const warnings = detectWarnings(doc, "IMPLEMENT", "next");

    expect(warnings).toHaveLength(0);
  });

  it("should warn when task done without acceptance_criteria in IMPLEMENT phase", () => {
    const doc = makeDoc([
      { type: "task", status: "done", sprint: "s1" },
    ]);
    const warnings = detectWarnings(doc, "IMPLEMENT", "update_status");

    expect(warnings.some((w) => w.code === "no_acceptance_criteria")).toBe(true);
  });

  it("should not warn about acceptance_criteria when they exist", () => {
    const doc = makeDoc([
      { type: "task", status: "done", sprint: "s1" },
      { type: "acceptance_criteria", status: "done" },
    ]);
    const warnings = detectWarnings(doc, "IMPLEMENT", "update_status");

    expect(warnings.some((w) => w.code === "no_acceptance_criteria")).toBe(false);
  });
});

describe("buildLifecycleBlock suggestedMcpAgents", () => {
  it("should include suggestedMcpAgents for IMPLEMENT phase", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress", sprint: "s1" }]);
    const block = buildLifecycleBlock(doc);
    expect(block.phase).toBe("IMPLEMENT");
    expect(block.suggestedMcpAgents).toBeDefined();
    expect(block.suggestedMcpAgents!.length).toBeGreaterThan(0);
    const names = block.suggestedMcpAgents!.map((a) => a.name);
    expect(names).toContain("serena");
    expect(names).toContain("gitnexus");
  });

  it("should not include suggestedMcpAgents for ANALYZE phase", () => {
    const doc = makeDoc();
    const block = buildLifecycleBlock(doc);
    expect(block.phase).toBe("ANALYZE");
    expect(block.suggestedMcpAgents ?? []).toHaveLength(0);
  });

  it("should include playwright for VALIDATE phase", () => {
    const doc = makeDoc([
      { type: "task", status: "done", sprint: "s1" },
      { type: "task", status: "done", sprint: "s1" },
      { type: "task", status: "ready", sprint: "s1" },
    ]);
    const block = buildLifecycleBlock(doc);
    expect(block.phase).toBe("VALIDATE");
    expect(block.suggestedMcpAgents).toBeDefined();
    const names = block.suggestedMcpAgents!.map((a) => a.name);
    expect(names).toContain("playwright");
  });
});
