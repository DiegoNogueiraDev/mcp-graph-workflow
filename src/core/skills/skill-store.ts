/**
 * Skill Store — persistence layer for skill preferences and custom skills.
 * Uses SQLite tables created by migration v9.
 */

import type Database from "better-sqlite3";
import { generateId } from "../utils/id.js";
import { now } from "../utils/time.js";
import { logger } from "../utils/logger.js";
import { ValidationError } from "../utils/errors.js";
import type { CustomSkill, CustomSkillInput } from "../../schemas/skill.schema.js";

// ── Row types ────────────────────────────────────────

interface PreferenceRow {
  project_id: string;
  skill_name: string;
  enabled: number;
  updated_at: string;
}

interface CustomSkillRow {
  id: string;
  project_id: string;
  name: string;
  description: string;
  category: string;
  phases: string;
  instructions: string;
  created_at: string;
  updated_at: string;
}

// ── Mapping helpers ──────────────────────────────────

function rowToCustomSkill(row: CustomSkillRow): CustomSkill {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    category: row.category,
    phases: JSON.parse(row.phases) as CustomSkill["phases"],
    instructions: row.instructions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Preferences ──────────────────────────────────────

export function setSkillEnabled(db: Database.Database, projectId: string, skillName: string, enabled: boolean): void {
  logger.debug("skill-store:setEnabled", { projectId, skillName, enabled });
  db.prepare(`
    INSERT INTO skill_preferences (project_id, skill_name, enabled, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(project_id, skill_name) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at
  `).run(projectId, skillName, enabled ? 1 : 0, now());
}

export function getSkillPreferences(db: Database.Database, projectId: string): Map<string, boolean> {
  const rows = db.prepare(
    "SELECT skill_name, enabled FROM skill_preferences WHERE project_id = ?",
  ).all(projectId) as PreferenceRow[];

  const map = new Map<string, boolean>();
  for (const row of rows) {
    map.set(row.skill_name, row.enabled === 1);
  }
  return map;
}

// ── Custom Skills CRUD ───────────────────────────────

export function createCustomSkill(db: Database.Database, projectId: string, data: CustomSkillInput): CustomSkill {
  const id = generateId("skill");
  const timestamp = now();

  logger.info("skill-store:create", { projectId, name: data.name });

  try {
    db.prepare(`
      INSERT INTO custom_skills (id, project_id, name, description, category, phases, instructions, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, projectId, data.name, data.description, data.category ?? "know-me",
      JSON.stringify(data.phases), data.instructions, timestamp, timestamp,
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
      throw new ValidationError(`Custom skill '${data.name}' already exists in this project`, []);
    }
    throw err;
  }

  return {
    id,
    projectId,
    name: data.name,
    description: data.description,
    category: data.category ?? "know-me",
    phases: data.phases,
    instructions: data.instructions,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateCustomSkill(
  db: Database.Database,
  projectId: string,
  id: string,
  data: Partial<CustomSkillInput>,
): CustomSkill {
  const existing = db.prepare(
    "SELECT * FROM custom_skills WHERE id = ? AND project_id = ?",
  ).get(id, projectId) as CustomSkillRow | undefined;

  if (!existing) {
    throw new ValidationError(`Custom skill not found: ${id}`, []);
  }

  const timestamp = now();
  const updated = {
    name: data.name ?? existing.name,
    description: data.description ?? existing.description,
    category: data.category ?? existing.category,
    phases: data.phases ? JSON.stringify(data.phases) : existing.phases,
    instructions: data.instructions ?? existing.instructions,
  };

  logger.info("skill-store:update", { projectId, id });

  db.prepare(`
    UPDATE custom_skills
    SET name = ?, description = ?, category = ?, phases = ?, instructions = ?, updated_at = ?
    WHERE id = ? AND project_id = ?
  `).run(
    updated.name, updated.description, updated.category,
    updated.phases, updated.instructions, timestamp, id, projectId,
  );

  return rowToCustomSkill({
    ...existing,
    ...updated,
    updated_at: timestamp,
  });
}

export function deleteCustomSkill(db: Database.Database, projectId: string, id: string): void {
  logger.info("skill-store:delete", { projectId, id });
  const result = db.prepare(
    "DELETE FROM custom_skills WHERE id = ? AND project_id = ?",
  ).run(id, projectId);

  if (result.changes === 0) {
    throw new ValidationError(`Custom skill not found: ${id}`, []);
  }
}

export function getCustomSkills(db: Database.Database, projectId: string): CustomSkill[] {
  const rows = db.prepare(
    "SELECT * FROM custom_skills WHERE project_id = ? ORDER BY created_at",
  ).all(projectId) as CustomSkillRow[];

  return rows.map(rowToCustomSkill);
}

export function getCustomSkillByName(db: Database.Database, projectId: string, name: string): CustomSkill | undefined {
  const row = db.prepare(
    "SELECT * FROM custom_skills WHERE project_id = ? AND name = ?",
  ).get(projectId, name) as CustomSkillRow | undefined;

  return row ? rowToCustomSkill(row) : undefined;
}
