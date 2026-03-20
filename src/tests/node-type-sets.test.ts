import { describe, it, expect } from "vitest";
import {
  TASK_TYPES,
  REQUIREMENT_TYPES,
  DESIGN_TYPES,
  DESIGN_ONLY_TYPES,
  FEEDBACK_TYPES,
} from "../core/utils/node-type-sets.js";

describe("node type sets", () => {
  describe("TASK_TYPES", () => {
    it("should contain task and subtask", () => {
      expect(TASK_TYPES.has("task")).toBe(true);
      expect(TASK_TYPES.has("subtask")).toBe(true);
    });

    it("should not contain other types", () => {
      expect(TASK_TYPES.has("epic")).toBe(false);
      expect(TASK_TYPES.has("requirement")).toBe(false);
    });

    it("should have exactly 2 members", () => {
      expect(TASK_TYPES.size).toBe(2);
    });
  });

  describe("REQUIREMENT_TYPES", () => {
    it("should contain epic and requirement", () => {
      expect(REQUIREMENT_TYPES.has("epic")).toBe(true);
      expect(REQUIREMENT_TYPES.has("requirement")).toBe(true);
    });

    it("should have exactly 2 members", () => {
      expect(REQUIREMENT_TYPES.size).toBe(2);
    });
  });

  describe("DESIGN_TYPES", () => {
    it("should contain design-specific types", () => {
      expect(DESIGN_TYPES.has("decision")).toBe(true);
      expect(DESIGN_TYPES.has("constraint")).toBe(true);
      expect(DESIGN_TYPES.has("risk")).toBe(true);
      expect(DESIGN_TYPES.has("acceptance_criteria")).toBe(true);
    });

    it("should have exactly 4 members", () => {
      expect(DESIGN_TYPES.size).toBe(4);
    });
  });

  describe("DESIGN_ONLY_TYPES", () => {
    it("should contain all design-only types", () => {
      expect(DESIGN_ONLY_TYPES.has("requirement")).toBe(true);
      expect(DESIGN_ONLY_TYPES.has("epic")).toBe(true);
      expect(DESIGN_ONLY_TYPES.has("decision")).toBe(true);
      expect(DESIGN_ONLY_TYPES.has("constraint")).toBe(true);
      expect(DESIGN_ONLY_TYPES.has("milestone")).toBe(true);
      expect(DESIGN_ONLY_TYPES.has("risk")).toBe(true);
      expect(DESIGN_ONLY_TYPES.has("acceptance_criteria")).toBe(true);
    });

    it("should have exactly 7 members", () => {
      expect(DESIGN_ONLY_TYPES.size).toBe(7);
    });

    it("should not contain task types", () => {
      expect(DESIGN_ONLY_TYPES.has("task")).toBe(false);
      expect(DESIGN_ONLY_TYPES.has("subtask")).toBe(false);
    });
  });

  describe("FEEDBACK_TYPES", () => {
    it("should contain feedback-relevant types", () => {
      expect(FEEDBACK_TYPES.has("requirement")).toBe(true);
      expect(FEEDBACK_TYPES.has("risk")).toBe(true);
      expect(FEEDBACK_TYPES.has("constraint")).toBe(true);
    });

    it("should have exactly 3 members", () => {
      expect(FEEDBACK_TYPES.size).toBe(3);
    });
  });

  describe("immutability", () => {
    it("all sets should be ReadonlySet (no add/delete/clear at runtime)", () => {
      // ReadonlySet type prevents mutation at compile time;
      // at runtime, the underlying Set still has methods, but the
      // contract is clear — callers must not mutate.
      expect(TASK_TYPES).toBeInstanceOf(Set);
      expect(REQUIREMENT_TYPES).toBeInstanceOf(Set);
      expect(DESIGN_TYPES).toBeInstanceOf(Set);
      expect(DESIGN_ONLY_TYPES).toBeInstanceOf(Set);
      expect(FEEDBACK_TYPES).toBeInstanceOf(Set);
    });
  });
});
