import { describe, it, expect } from "vitest";
import { checkToolGate } from "../core/planner/lifecycle-phase.js";
import type { GraphDocument } from "../core/graph/graph-types.js";

const emptyDoc: GraphDocument = {
  version: "1.0",
  project: { id: "test", name: "test", createdAt: "", updatedAt: "" },
  nodes: [],
  edges: [],
  indexes: { byId: {}, childrenByParent: {}, incomingByNode: {}, outgoingByNode: {} },
  meta: { sourceFiles: [], lastImport: null },
};

describe("BUG-23: Lifecycle strict mode tool restrictions", () => {
  it("should block known non-recommended tools in strict mode with error severity", () => {
    // manage_skill is known (in LISTENING recommended) but not in IMPLEMENT
    const warnings = checkToolGate(emptyDoc, "IMPLEMENT", "manage_skill", "strict");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].severity).toBe("error");
    expect(warnings[0].code).toBe("tool_phase_blocked");
  });

  it("should warn for known non-recommended tools in advisory mode", () => {
    const warnings = checkToolGate(emptyDoc, "IMPLEMENT", "manage_skill", "advisory");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].severity).toBe("warning");
  });

  it("should allow recommended tools in IMPLEMENT phase", () => {
    const warnings = checkToolGate(emptyDoc, "IMPLEMENT", "next", "strict");
    expect(warnings).toHaveLength(0);
  });

  it("should always allow infrastructure tools like list", () => {
    const warnings = checkToolGate(emptyDoc, "IMPLEMENT", "list", "strict");
    expect(warnings).toHaveLength(0);
  });

  it("should allow update_status in IMPLEMENT phase", () => {
    const warnings = checkToolGate(emptyDoc, "IMPLEMENT", "update_status", "strict");
    expect(warnings).toHaveLength(0);
  });

  it("should block update_status in ANALYZE phase", () => {
    const warnings = checkToolGate(emptyDoc, "ANALYZE", "update_status", "strict");
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("should allow import_prd in ANALYZE phase", () => {
    const warnings = checkToolGate(emptyDoc, "ANALYZE", "import_prd", "strict");
    expect(warnings).toHaveLength(0);
  });

  it("should allow unknown/external tools in any phase", () => {
    const warnings = checkToolGate(emptyDoc, "ANALYZE", "some_unknown_tool", "strict");
    expect(warnings).toHaveLength(0);
  });

  it("should block validate_task in ANALYZE phase", () => {
    const warnings = checkToolGate(emptyDoc, "ANALYZE", "validate_task", "strict");
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("should allow validate_task in IMPLEMENT phase", () => {
    const warnings = checkToolGate(emptyDoc, "IMPLEMENT", "validate_task", "strict");
    expect(warnings).toHaveLength(0);
  });
});
