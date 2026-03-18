import { describe, it, expect } from "vitest";
import {
  BUILT_IN_SKILLS,
  getBuiltInSkills,
  getSkillsByPhase,
  getSkillByName,
  type BuiltInSkill,
} from "../core/skills/built-in-skills.js";

describe("BuiltInSkills Registry", () => {
  it("should have exactly 19 built-in skills", () => {
    expect(BUILT_IN_SKILLS).toHaveLength(19);
  });

  it("should have unique names across all skills", () => {
    const names = BUILT_IN_SKILLS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("should have non-empty instructions for every skill", () => {
    for (const skill of BUILT_IN_SKILLS) {
      expect(skill.instructions.length).toBeGreaterThan(0);
    }
  });

  it("should have at least one phase for every skill", () => {
    for (const skill of BUILT_IN_SKILLS) {
      expect(skill.phases.length).toBeGreaterThan(0);
    }
  });

  it("should only contain valid lifecycle phases", () => {
    const validPhases = new Set(["ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "LISTENING"]);
    for (const skill of BUILT_IN_SKILLS) {
      for (const phase of skill.phases) {
        expect(validPhases.has(phase)).toBe(true);
      }
    }
  });

  it("should have non-empty description and category for every skill", () => {
    for (const skill of BUILT_IN_SKILLS) {
      expect(skill.description.length).toBeGreaterThan(0);
      expect(skill.category.length).toBeGreaterThan(0);
    }
  });

  it("should cover ANALYZE, DESIGN, PLAN, IMPLEMENT, VALIDATE, REVIEW phases", () => {
    const coveredPhases = new Set(BUILT_IN_SKILLS.flatMap((s) => s.phases));
    expect(coveredPhases.has("ANALYZE")).toBe(true);
    expect(coveredPhases.has("DESIGN")).toBe(true);
    expect(coveredPhases.has("PLAN")).toBe(true);
    expect(coveredPhases.has("IMPLEMENT")).toBe(true);
    expect(coveredPhases.has("VALIDATE")).toBe(true);
    expect(coveredPhases.has("REVIEW")).toBe(true);
  });
});

describe("getBuiltInSkills", () => {
  it("should return all built-in skills", () => {
    const skills = getBuiltInSkills();
    expect(skills).toHaveLength(19);
  });
});

describe("getSkillsByPhase", () => {
  it("should return 3 skills for ANALYZE", () => {
    const skills = getSkillsByPhase("ANALYZE");
    expect(skills).toHaveLength(3);
    expect(skills.every((s: BuiltInSkill) => s.phases.includes("ANALYZE"))).toBe(true);
  });

  it("should return 3 skills for DESIGN", () => {
    const skills = getSkillsByPhase("DESIGN");
    expect(skills).toHaveLength(3);
  });

  it("should return 2 skills for PLAN", () => {
    const skills = getSkillsByPhase("PLAN");
    expect(skills).toHaveLength(2);
  });

  it("should return 2 skills for IMPLEMENT", () => {
    const skills = getSkillsByPhase("IMPLEMENT");
    expect(skills).toHaveLength(2);
  });

  it("should return 4 skills for VALIDATE", () => {
    const skills = getSkillsByPhase("VALIDATE");
    expect(skills).toHaveLength(4);
  });

  it("should return 5 skills for REVIEW", () => {
    const skills = getSkillsByPhase("REVIEW");
    expect(skills).toHaveLength(5);
  });

  it("should return empty array for HANDOFF (no built-in skills assigned)", () => {
    const skills = getSkillsByPhase("HANDOFF");
    expect(skills).toHaveLength(0);
  });

  it("should return empty array for LISTENING (no built-in skills assigned)", () => {
    const skills = getSkillsByPhase("LISTENING");
    expect(skills).toHaveLength(0);
  });
});

describe("getSkillByName", () => {
  it("should find a skill by name", () => {
    const skill = getSkillByName("code-reviewer");
    expect(skill).toBeDefined();
    expect(skill!.name).toBe("code-reviewer");
    expect(skill!.phases).toContain("REVIEW");
  });

  it("should return undefined for non-existent skill", () => {
    const skill = getSkillByName("non-existent-skill");
    expect(skill).toBeUndefined();
  });
});
