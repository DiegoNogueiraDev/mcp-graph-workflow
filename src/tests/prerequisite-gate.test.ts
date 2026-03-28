import { describe, it, expect } from "vitest";
import {
  checkPrerequisiteGate,
  PHASE_PREREQUISITES,
  type LifecyclePhase,
} from "../core/planner/lifecycle-phase.js";

/**
 * Helper: creates a hasBeenCalled mock from a set of recorded calls.
 * Each call is [nodeId | null, toolName, toolArgs?].
 */
function mockHasBeenCalled(
  calls: Array<[string | null, string, string?]>,
): (nodeId: string | null, tool: string, args?: string) => boolean {
  return (nodeId, tool, args) =>
    calls.some(
      ([nId, t, a]) =>
        nId === nodeId &&
        t === tool &&
        (args === undefined || (a !== undefined && a.includes(args))),
    );
}

describe("PHASE_PREREQUISITES", () => {
  it("should have rules for IMPLEMENT, VALIDATE, DESIGN, PLAN, REVIEW, HANDOFF", () => {
    expect(PHASE_PREREQUISITES.IMPLEMENT.length).toBeGreaterThan(0);
    expect(PHASE_PREREQUISITES.VALIDATE.length).toBeGreaterThan(0);
    expect(PHASE_PREREQUISITES.DESIGN.length).toBeGreaterThan(0);
    expect(PHASE_PREREQUISITES.PLAN.length).toBeGreaterThan(0);
    expect(PHASE_PREREQUISITES.REVIEW.length).toBeGreaterThan(0);
    expect(PHASE_PREREQUISITES.HANDOFF.length).toBeGreaterThan(0);
  });

  it("should have empty rules for ANALYZE and LISTENING", () => {
    expect(PHASE_PREREQUISITES.ANALYZE).toEqual([]);
    expect(PHASE_PREREQUISITES.LISTENING).toEqual([]);
  });
});

describe("checkPrerequisiteGate", () => {
  // ── IMPLEMENT phase ──

  describe("IMPLEMENT — update_status(in_progress)", () => {
    const phase: LifecyclePhase = "IMPLEMENT";
    const toolName = "update_status";
    const toolArgs = { status: "in_progress" };

    it("should return error when next was NOT called (strict)", () => {
      const warnings = checkPrerequisiteGate(
        phase, toolName, toolArgs, "node-1",
        mockHasBeenCalled([]),
        "strict",
      );
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w) => w.severity === "error")).toBe(true);
      expect(warnings[0].code).toBe("prerequisite_missing");
    });

    it("should pass when next was called (project-scoped)", () => {
      const warnings = checkPrerequisiteGate(
        phase, toolName, toolArgs, "node-1",
        mockHasBeenCalled([[null, "next"]]),
        "strict",
      );
      expect(warnings).toEqual([]);
    });

    it("should return warning in advisory mode", () => {
      const warnings = checkPrerequisiteGate(
        phase, toolName, toolArgs, "node-1",
        mockHasBeenCalled([]),
        "advisory",
      );
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.every((w) => w.severity === "warning")).toBe(true);
    });
  });

  describe("IMPLEMENT — update_status(done)", () => {
    const phase: LifecyclePhase = "IMPLEMENT";
    const toolName = "update_status";
    const toolArgs = { status: "done" };

    it("should require context + rag_context + analyze:implement_done", () => {
      const warnings = checkPrerequisiteGate(
        phase, toolName, toolArgs, "node-1",
        mockHasBeenCalled([]),
        "strict",
      );
      expect(warnings.length).toBe(3);
      const missingTools = warnings.map((w) => w.message);
      expect(missingTools.some((m) => m.includes("context"))).toBe(true);
      expect(missingTools.some((m) => m.includes("rag_context"))).toBe(true);
      expect(missingTools.some((m) => m.includes("analyze"))).toBe(true);
    });

    it("should pass when all prerequisites are met (node-scoped)", () => {
      const warnings = checkPrerequisiteGate(
        phase, toolName, toolArgs, "node-1",
        mockHasBeenCalled([
          ["node-1", "context"],
          ["node-1", "rag_context"],
          ["node-1", "analyze", '{"mode":"implement_done"}'],
        ]),
        "strict",
      );
      expect(warnings).toEqual([]);
    });

    it("should fail if only some prerequisites are met", () => {
      const warnings = checkPrerequisiteGate(
        phase, toolName, toolArgs, "node-1",
        mockHasBeenCalled([
          ["node-1", "context"],
        ]),
        "strict",
      );
      expect(warnings.length).toBe(2);
    });
  });

  // ── VALIDATE phase ──

  describe("VALIDATE — update_status(done)", () => {
    const phase: LifecyclePhase = "VALIDATE";
    const toolName = "update_status";
    const toolArgs = { status: "done" };

    it("should require validate + analyze:validate_ready", () => {
      const warnings = checkPrerequisiteGate(
        phase, toolName, toolArgs, "node-1",
        mockHasBeenCalled([]),
        "strict",
      );
      expect(warnings.length).toBe(2);
    });

    it("should pass when all prerequisites met", () => {
      const warnings = checkPrerequisiteGate(
        phase, toolName, toolArgs, "node-1",
        mockHasBeenCalled([
          ["node-1", "validate"],
          [null, "analyze", '{"mode":"validate_ready"}'],
        ]),
        "strict",
      );
      expect(warnings).toEqual([]);
    });
  });

  // ── DESIGN phase ──

  describe("DESIGN — set_phase(PLAN)", () => {
    const phase: LifecyclePhase = "DESIGN";
    const toolName = "set_phase";
    const toolArgs = { phase: "PLAN" };

    it("should require analyze:design_ready", () => {
      const warnings = checkPrerequisiteGate(
        phase, toolName, toolArgs, undefined,
        mockHasBeenCalled([]),
        "strict",
      );
      expect(warnings.length).toBe(1);
      expect(warnings[0].message).toContain("analyze");
    });

    it("should pass when analyze:design_ready was called", () => {
      const warnings = checkPrerequisiteGate(
        phase, toolName, toolArgs, undefined,
        mockHasBeenCalled([
          [null, "analyze", '{"mode":"design_ready"}'],
        ]),
        "strict",
      );
      expect(warnings).toEqual([]);
    });
  });

  // ── PLAN phase ──

  describe("PLAN — set_phase(IMPLEMENT)", () => {
    const phase: LifecyclePhase = "PLAN";
    const toolName = "set_phase";
    const toolArgs = { phase: "IMPLEMENT" };

    it("should require sync_stack_docs + plan_sprint", () => {
      const warnings = checkPrerequisiteGate(
        phase, toolName, toolArgs, undefined,
        mockHasBeenCalled([]),
        "strict",
      );
      expect(warnings.length).toBe(2);
    });

    it("should pass when both prerequisites met", () => {
      const warnings = checkPrerequisiteGate(
        phase, toolName, toolArgs, undefined,
        mockHasBeenCalled([
          [null, "sync_stack_docs"],
          [null, "plan_sprint"],
        ]),
        "strict",
      );
      expect(warnings).toEqual([]);
    });
  });

  // ── No trigger match ──

  describe("no trigger match", () => {
    it("should return empty when tool has no prerequisites in phase", () => {
      const warnings = checkPrerequisiteGate(
        "IMPLEMENT", "list", {}, undefined,
        mockHasBeenCalled([]),
        "strict",
      );
      expect(warnings).toEqual([]);
    });

    it("should return empty when trigger condition does not match", () => {
      const warnings = checkPrerequisiteGate(
        "IMPLEMENT", "update_status", { status: "blocked" }, "node-1",
        mockHasBeenCalled([]),
        "strict",
      );
      expect(warnings).toEqual([]);
    });
  });

  // ── REVIEW phase ──

  describe("REVIEW — set_phase(HANDOFF)", () => {
    it("should require analyze:review_ready + export", () => {
      const warnings = checkPrerequisiteGate(
        "REVIEW", "set_phase", { phase: "HANDOFF" }, undefined,
        mockHasBeenCalled([]),
        "strict",
      );
      expect(warnings.length).toBe(2);
    });
  });

  // ── HANDOFF phase ──

  describe("HANDOFF — set_phase(LISTENING)", () => {
    it("should require analyze:handoff_ready + snapshot + write_memory", () => {
      const warnings = checkPrerequisiteGate(
        "HANDOFF", "set_phase", { phase: "LISTENING" }, undefined,
        mockHasBeenCalled([]),
        "strict",
      );
      expect(warnings.length).toBe(3);
    });
  });
});
