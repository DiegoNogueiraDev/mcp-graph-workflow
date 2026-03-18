import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { configureDb, runMigrations } from "../core/store/migrations.js";
import {
  setSkillEnabled,
  getSkillPreferences,
  createCustomSkill,
  updateCustomSkill,
  deleteCustomSkill,
  getCustomSkills,
  getCustomSkillByName,
} from "../core/skills/skill-store.js";
import type { CustomSkillInput } from "../schemas/skill.schema.js";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  configureDb(db);
  runMigrations(db);
  // Insert a test project
  db.prepare("INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
    "proj_test", "Test Project", new Date().toISOString(), new Date().toISOString(),
  );
  return db;
}

const PROJECT_ID = "proj_test";

function validInput(overrides?: Partial<CustomSkillInput>): CustomSkillInput {
  return {
    name: "test-skill",
    description: "A test skill",
    category: "know-me",
    phases: ["IMPLEMENT"],
    instructions: "Do the thing",
    ...overrides,
  };
}

describe("Skill Preferences", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("should return empty map when no preferences set", () => {
    const prefs = getSkillPreferences(db, PROJECT_ID);
    expect(prefs.size).toBe(0);
  });

  it("should set and get skill enabled preference", () => {
    setSkillEnabled(db, PROJECT_ID, "kiss", false);
    const prefs = getSkillPreferences(db, PROJECT_ID);
    expect(prefs.get("kiss")).toBe(false);
  });

  it("should toggle skill preference", () => {
    setSkillEnabled(db, PROJECT_ID, "yagni", false);
    setSkillEnabled(db, PROJECT_ID, "yagni", true);
    const prefs = getSkillPreferences(db, PROJECT_ID);
    expect(prefs.get("yagni")).toBe(true);
  });

  it("should handle multiple skill preferences", () => {
    setSkillEnabled(db, PROJECT_ID, "kiss", false);
    setSkillEnabled(db, PROJECT_ID, "dry", true);
    setSkillEnabled(db, PROJECT_ID, "solid-srp", false);
    const prefs = getSkillPreferences(db, PROJECT_ID);
    expect(prefs.size).toBe(3);
    expect(prefs.get("kiss")).toBe(false);
    expect(prefs.get("dry")).toBe(true);
    expect(prefs.get("solid-srp")).toBe(false);
  });

  it("should isolate preferences between projects", () => {
    db.prepare("INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
      "proj_other", "Other Project", new Date().toISOString(), new Date().toISOString(),
    );
    setSkillEnabled(db, PROJECT_ID, "kiss", false);
    setSkillEnabled(db, "proj_other", "kiss", true);

    expect(getSkillPreferences(db, PROJECT_ID).get("kiss")).toBe(false);
    expect(getSkillPreferences(db, "proj_other").get("kiss")).toBe(true);
  });
});

describe("Custom Skills CRUD", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it("should create a custom skill", () => {
    const skill = createCustomSkill(db, PROJECT_ID, validInput());
    expect(skill.id).toMatch(/^skill_/);
    expect(skill.name).toBe("test-skill");
    expect(skill.projectId).toBe(PROJECT_ID);
    expect(skill.phases).toEqual(["IMPLEMENT"]);
  });

  it("should reject duplicate skill name in same project", () => {
    createCustomSkill(db, PROJECT_ID, validInput());
    expect(() => createCustomSkill(db, PROJECT_ID, validInput())).toThrow("already exists");
  });

  it("should allow same name in different projects", () => {
    db.prepare("INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
      "proj_other", "Other", new Date().toISOString(), new Date().toISOString(),
    );
    const a = createCustomSkill(db, PROJECT_ID, validInput());
    const b = createCustomSkill(db, "proj_other", validInput());
    expect(a.id).not.toBe(b.id);
  });

  it("should list custom skills for a project", () => {
    createCustomSkill(db, PROJECT_ID, validInput({ name: "skill-a" }));
    createCustomSkill(db, PROJECT_ID, validInput({ name: "skill-b" }));
    const skills = getCustomSkills(db, PROJECT_ID);
    expect(skills).toHaveLength(2);
  });

  it("should get custom skill by name", () => {
    createCustomSkill(db, PROJECT_ID, validInput({ name: "my-flow" }));
    const skill = getCustomSkillByName(db, PROJECT_ID, "my-flow");
    expect(skill).toBeDefined();
    expect(skill!.name).toBe("my-flow");
  });

  it("should return undefined for non-existent skill name", () => {
    const skill = getCustomSkillByName(db, PROJECT_ID, "nope");
    expect(skill).toBeUndefined();
  });

  it("should update a custom skill", () => {
    const created = createCustomSkill(db, PROJECT_ID, validInput());
    const updated = updateCustomSkill(db, PROJECT_ID, created.id, {
      description: "Updated desc",
      phases: ["DESIGN", "REVIEW"],
    });
    expect(updated.description).toBe("Updated desc");
    expect(updated.phases).toEqual(["DESIGN", "REVIEW"]);
    expect(updated.name).toBe("test-skill"); // unchanged
  });

  it("should throw when updating non-existent skill", () => {
    expect(() => updateCustomSkill(db, PROJECT_ID, "nonexistent", { description: "x" }))
      .toThrow("not found");
  });

  it("should delete a custom skill", () => {
    const created = createCustomSkill(db, PROJECT_ID, validInput());
    deleteCustomSkill(db, PROJECT_ID, created.id);
    expect(getCustomSkills(db, PROJECT_ID)).toHaveLength(0);
  });

  it("should throw when deleting non-existent skill", () => {
    expect(() => deleteCustomSkill(db, PROJECT_ID, "nonexistent")).toThrow("not found");
  });
});
