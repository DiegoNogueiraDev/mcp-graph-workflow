/**
 * Translation Store — SQLite CRUD for translation_jobs table.
 * Follows the same pattern as code-store.ts (shared Database, prepared statements).
 */

import type Database from "better-sqlite3";
import type { TranslationJob, TranslationJobStatus, TranslationScope } from "./translation-types.js";
import { generateId } from "../utils/id.js";

interface JobRow {
  id: string;
  project_id: string;
  source_language: string;
  target_language: string;
  source_code: string;
  target_code: string | null;
  status: string;
  scope: string;
  constraints: string | null;
  analysis: string | null;
  result: string | null;
  evidence: string | null;
  confidence_score: number | null;
  warnings: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

function rowToJob(row: JobRow): TranslationJob {
  return {
    id: row.id,
    projectId: row.project_id,
    sourceLanguage: row.source_language,
    targetLanguage: row.target_language,
    sourceCode: row.source_code,
    ...(row.target_code != null && { targetCode: row.target_code }),
    status: row.status as TranslationJobStatus,
    scope: row.scope as TranslationScope,
    ...(row.constraints != null && { constraints: JSON.parse(row.constraints) as Record<string, unknown> }),
    ...(row.confidence_score != null && { confidenceScore: row.confidence_score }),
    ...(row.warnings != null && { warnings: JSON.parse(row.warnings) as string[] }),
    ...(row.error_message != null && { errorMessage: row.error_message }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateJobInput {
  projectId: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceCode: string;
  scope: TranslationScope;
  constraints?: Record<string, unknown>;
}

export interface UpdateJobInput {
  status?: TranslationJobStatus;
  targetCode?: string;
  confidenceScore?: number;
  warnings?: string[];
  errorMessage?: string;
  analysis?: Record<string, unknown>;
  result?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
}

export class TranslationStore {
  constructor(private readonly db: Database.Database) {}

  createJob(input: CreateJobInput): TranslationJob {
    const id = generateId();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO translation_jobs (id, project_id, source_language, target_language, source_code, status, scope, constraints, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `).run(
      id,
      input.projectId,
      input.sourceLanguage,
      input.targetLanguage,
      input.sourceCode,
      input.scope,
      input.constraints ? JSON.stringify(input.constraints) : null,
      now,
      now,
    );

    return this.getJob(id) as TranslationJob;
  }

  getJob(id: string): TranslationJob | null {
    const row = this.db.prepare("SELECT * FROM translation_jobs WHERE id = ?").get(id) as JobRow | undefined;
    return row ? rowToJob(row) : null;
  }

  listJobs(projectId: string): TranslationJob[] {
    const rows = this.db.prepare(
      "SELECT * FROM translation_jobs WHERE project_id = ? ORDER BY created_at DESC",
    ).all(projectId) as JobRow[];
    return rows.map(rowToJob);
  }

  updateJob(id: string, input: UpdateJobInput): TranslationJob | null {
    const existing = this.getJob(id);
    if (!existing) return null;

    const sets: string[] = ["updated_at = ?"];
    const values: unknown[] = [new Date().toISOString()];

    if (input.status !== undefined) { sets.push("status = ?"); values.push(input.status); }
    if (input.targetCode !== undefined) { sets.push("target_code = ?"); values.push(input.targetCode); }
    if (input.confidenceScore !== undefined) { sets.push("confidence_score = ?"); values.push(input.confidenceScore); }
    if (input.warnings !== undefined) { sets.push("warnings = ?"); values.push(JSON.stringify(input.warnings)); }
    if (input.errorMessage !== undefined) { sets.push("error_message = ?"); values.push(input.errorMessage); }
    if (input.analysis !== undefined) { sets.push("analysis = ?"); values.push(JSON.stringify(input.analysis)); }
    if (input.result !== undefined) { sets.push("result = ?"); values.push(JSON.stringify(input.result)); }
    if (input.evidence !== undefined) { sets.push("evidence = ?"); values.push(JSON.stringify(input.evidence)); }

    this.db.prepare(`UPDATE translation_jobs SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);
    return this.getJob(id);
  }

  deleteJob(id: string): boolean {
    const result = this.db.prepare("DELETE FROM translation_jobs WHERE id = ?").run(id);
    return result.changes > 0;
  }

  getJobsByLanguagePair(projectId: string, sourceLang: string, targetLang: string): TranslationJob[] {
    const rows = this.db.prepare(
      "SELECT * FROM translation_jobs WHERE project_id = ? AND source_language = ? AND target_language = ? ORDER BY created_at DESC",
    ).all(projectId, sourceLang, targetLang) as JobRow[];
    return rows.map(rowToJob);
  }
}
