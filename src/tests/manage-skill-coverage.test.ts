import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import {
  setSkillEnabled,
  getSkillPreferences,
  createCustomSkill,
  updateCustomSkill,
  deleteCustomSkill,
  getCustomSkills,
  getCustomSkillByName,
} from "../core/skills/skill-store.js";
import { ValidationError } from "../core/utils/errors.js";
import type { CustomSkillInput } from "../schemas/skill.schema.js";

function makeSkillInput(overrides: Partial<CustomSkillInput> = {}): CustomSkillInput {
  return {
    name: "test-skill",
    description: "A test custom skill",
    category: "know-me",
    phases: ["IMPLEMENT"],
    instructions: "Do something",
    ...overrides,
  };
}

describe("Skill Store — manage-skill coverage", () => {
  let store: SqliteStore;
  let db: ReturnType<SqliteStore["getDb"]>;
  let projectId: string;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    db = store.getDb();
    const project = store.getProject();
    projectId = project!.id;
  });

  afterEach(() => {
    store.close();
  });

  // ── Preferences ──────────────────────────────────────

  it("should set and get skill preferences", () => {
    setSkillEnabled(db, projectId, "my-skill", false);
    const prefs = getSkillPreferences(db, projectId);
    expect(prefs.get("my-skill")).toBe(false);
  });

  it("should toggle preference from false to true", () => {
    setSkillEnabled(db, projectId, "toggled", false);
    setSkillEnabled(db, projectId, "toggled", true);
    const prefs = getSkillPreferences(db, projectId);
    expect(prefs.get("toggled")).toBe(true);
  });

  it("should return empty preferences for new project", () => {
    const prefs = getSkillPreferences(db, projectId);
    expect(prefs.size).toBe(0);
  });

  // ── Custom Skill CRUD ────────────────────────────────

  it("should create a custom skill", () => {
    const input = makeSkillInput();
    const skill = createCustomSkill(db, projectId, input);
    expect(skill.id).toBeDefined();
    expect(skill.name).toBe("test-skill");
    expect(skill.projectId).toBe(projectId);
    expect(skill.phases).toEqual(["IMPLEMENT"]);
    expect(skill.createdAt).toBeDefined();
    expect(skill.updatedAt).toBeDefined();
  });

  it("should throw on duplicate custom skill name", () => {
    const input = makeSkillInput();
    createCustomSkill(db, projectId, input);
    expect(() => createCustomSkill(db, projectId, input)).toThrow(
      ValidationError,
    );
  });

  it("should list custom skills", () => {
    createCustomSkill(db, projectId, makeSkillInput({ name: "skill-a" }));
    createCustomSkill(db, projectId, makeSkillInput({ name: "skill-b" }));
    const skills = getCustomSkills(db, projectId);
    expect(skills).toHaveLength(2);
    expect(skills[0].name).toBe("skill-a");
    expect(skills[1].name).toBe("skill-b");
  });

  it("should get custom skill by name", () => {
    createCustomSkill(db, projectId, makeSkillInput({ name: "findable" }));
    const skill = getCustomSkillByName(db, projectId, "findable");
    expect(skill).toBeDefined();
    expect(skill!.name).toBe("findable");
  });

  it("should return undefined for nonexistent skill name", () => {
    const skill = getCustomSkillByName(db, projectId, "nope");
    expect(skill).toBeUndefined();
  });

  it("should update a custom skill", () => {
    const created = createCustomSkill(db, projectId, makeSkillInput());
    const updated = updateCustomSkill(db, projectId, created.id, {
      description: "Updated desc",
    });
    expect(updated.description).toBe("Updated desc");
    expect(updated.name).toBe("test-skill"); // unchanged
  });

  it("should throw when updating nonexistent skill", () => {
    expect(() =>
      updateCustomSkill(db, projectId, "nonexistent-id", {
        description: "x",
      }),
    ).toThrow(ValidationError);
  });

  it("should delete a custom skill", () => {
    const created = createCustomSkill(db, projectId, makeSkillInput());
    deleteCustomSkill(db, projectId, created.id);
    const skills = getCustomSkills(db, projectId);
    expect(skills).toHaveLength(0);
  });

  it("should throw when deleting nonexistent skill", () => {
    expect(() => deleteCustomSkill(db, projectId, "nonexistent-id")).toThrow(
      ValidationError,
    );
  });

  it("should use default category 'know-me' when not provided", () => {
    const input = makeSkillInput();
    delete (input as Record<string, unknown>).category;
    const skill = createCustomSkill(db, projectId, {
      ...input,
      category: undefined as unknown as string,
    });
    expect(skill.category).toBe("know-me");
  });
});
