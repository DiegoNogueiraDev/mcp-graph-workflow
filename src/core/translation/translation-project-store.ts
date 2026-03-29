/**
 * Translation Project Store — SQLite CRUD for translation_projects and translation_project_files tables.
 * Follows the same pattern as translation-store.ts (shared Database, prepared statements).
 */

import type Database from "better-sqlite3";
import type {
  TranslationProject,
  TranslationProjectStatus,
  TranslationProjectFile,
  TranslationProjectFileStatus,
  CreateTranslationProjectInput,
  AddTranslationProjectFileInput,
} from "./translation-project-types.js";
import { generateId } from "../utils/id.js";
import { logger } from "../utils/logger.js";

// --- Row types (snake_case from SQLite) ---

interface ProjectRow {
  id: string;
  project_id: string;
  name: string;
  source_language: string | null;
  target_language: string;
  status: string;
  total_files: number;
  processed_files: number;
  overall_confidence: number | null;
  deterministic_pct: number | null;
  created_at: string;
  updated_at: string;
}

interface FileRow {
  id: string;
  translation_project_id: string;
  file_path: string;
  source_code: string;
  source_language: string | null;
  status: string;
  job_id: string | null;
  deterministic: number | null;
  analysis: string | null;
  confidence_score: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// --- Row mappers ---

function rowToProject(row: ProjectRow): TranslationProject {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    ...(row.source_language != null && { sourceLanguage: row.source_language }),
    targetLanguage: row.target_language,
    status: row.status as TranslationProjectStatus,
    totalFiles: row.total_files,
    processedFiles: row.processed_files,
    ...(row.overall_confidence != null && { overallConfidence: row.overall_confidence }),
    ...(row.deterministic_pct != null && { deterministicPct: row.deterministic_pct }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToFile(row: FileRow): TranslationProjectFile {
  return {
    id: row.id,
    translationProjectId: row.translation_project_id,
    filePath: row.file_path,
    sourceCode: row.source_code,
    ...(row.source_language != null && { sourceLanguage: row.source_language }),
    status: row.status as TranslationProjectFileStatus,
    ...(row.job_id != null && { jobId: row.job_id }),
    ...(row.deterministic != null && { deterministic: row.deterministic === 1 }),
    ...(row.analysis != null && { analysis: JSON.parse(row.analysis) as Record<string, unknown> }),
    ...(row.confidence_score != null && { confidenceScore: row.confidence_score }),
    ...(row.error_message != null && { errorMessage: row.error_message }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// --- Store ---

export class TranslationProjectStore {
  constructor(private readonly db: Database.Database) {}

  createProject(input: CreateTranslationProjectInput): TranslationProject {
    const id = generateId();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO translation_projects (id, project_id, name, source_language, target_language, status, total_files, processed_files, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'uploading', ?, 0, ?, ?)
    `).run(
      id,
      input.projectId,
      input.name,
      input.sourceLanguage ?? null,
      input.targetLanguage,
      input.totalFiles ?? 0,
      now,
      now,
    );

    logger.info("translation-project:create", { projectId: id, name: input.name });
    return this.getProject(id) as TranslationProject;
  }

  getProject(id: string): TranslationProject | null {
    const row = this.db.prepare(
      "SELECT * FROM translation_projects WHERE id = ?",
    ).get(id) as ProjectRow | undefined;
    return row ? rowToProject(row) : null;
  }

  listProjects(projectId: string): TranslationProject[] {
    const rows = this.db.prepare(
      "SELECT * FROM translation_projects WHERE project_id = ? ORDER BY created_at DESC",
    ).all(projectId) as ProjectRow[];
    return rows.map(rowToProject);
  }

  updateProject(
    id: string,
    input: Partial<{
      name: string;
      status: TranslationProjectStatus;
      sourceLanguage: string;
      totalFiles: number;
      processedFiles: number;
      overallConfidence: number;
      deterministicPct: number;
    }>,
  ): TranslationProject | null {
    const existing = this.getProject(id);
    if (!existing) return null;

    const sets: string[] = ["updated_at = ?"];
    const values: unknown[] = [new Date().toISOString()];

    if (input.name !== undefined) { sets.push("name = ?"); values.push(input.name); }
    if (input.status !== undefined) { sets.push("status = ?"); values.push(input.status); }
    if (input.sourceLanguage !== undefined) { sets.push("source_language = ?"); values.push(input.sourceLanguage); }
    if (input.totalFiles !== undefined) { sets.push("total_files = ?"); values.push(input.totalFiles); }
    if (input.processedFiles !== undefined) { sets.push("processed_files = ?"); values.push(input.processedFiles); }
    if (input.overallConfidence !== undefined) { sets.push("overall_confidence = ?"); values.push(input.overallConfidence); }
    if (input.deterministicPct !== undefined) { sets.push("deterministic_pct = ?"); values.push(input.deterministicPct); }

    this.db.prepare(`UPDATE translation_projects SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);

    logger.debug("translation-project:update", { projectId: id, fields: Object.keys(input) });
    return this.getProject(id);
  }

  deleteProject(id: string): boolean {
    // CASCADE: delete files first, then project
    this.db.prepare("DELETE FROM translation_project_files WHERE translation_project_id = ?").run(id);
    const result = this.db.prepare("DELETE FROM translation_projects WHERE id = ?").run(id);
    if (result.changes > 0) {
      logger.info("translation-project:delete", { projectId: id });
    }
    return result.changes > 0;
  }

  addFile(input: AddTranslationProjectFileInput): TranslationProjectFile {
    const id = generateId();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO translation_project_files (id, translation_project_id, file_path, source_code, source_language, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      id,
      input.translationProjectId,
      input.filePath,
      input.sourceCode,
      input.sourceLanguage ?? null,
      now,
      now,
    );

    logger.debug("translation-project:addFile", { fileId: id, filePath: input.filePath });
    return this.getFile(id) as TranslationProjectFile;
  }

  getFile(fileId: string): TranslationProjectFile | null {
    const row = this.db.prepare(
      "SELECT * FROM translation_project_files WHERE id = ?",
    ).get(fileId) as FileRow | undefined;
    return row ? rowToFile(row) : null;
  }

  getFiles(translationProjectId: string): TranslationProjectFile[] {
    const rows = this.db.prepare(
      "SELECT * FROM translation_project_files WHERE translation_project_id = ? ORDER BY file_path ASC",
    ).all(translationProjectId) as FileRow[];
    return rows.map(rowToFile);
  }

  updateFile(
    fileId: string,
    input: Partial<{
      status: TranslationProjectFileStatus;
      jobId: string;
      deterministic: boolean;
      analysis: Record<string, unknown>;
      confidenceScore: number;
      errorMessage: string;
      sourceLanguage: string;
    }>,
  ): TranslationProjectFile | null {
    const existing = this.getFile(fileId);
    if (!existing) return null;

    const sets: string[] = ["updated_at = ?"];
    const values: unknown[] = [new Date().toISOString()];

    if (input.status !== undefined) { sets.push("status = ?"); values.push(input.status); }
    if (input.jobId !== undefined) { sets.push("job_id = ?"); values.push(input.jobId); }
    if (input.deterministic !== undefined) { sets.push("deterministic = ?"); values.push(input.deterministic ? 1 : 0); }
    if (input.analysis !== undefined) { sets.push("analysis = ?"); values.push(JSON.stringify(input.analysis)); }
    if (input.confidenceScore !== undefined) { sets.push("confidence_score = ?"); values.push(input.confidenceScore); }
    if (input.errorMessage !== undefined) { sets.push("error_message = ?"); values.push(input.errorMessage); }
    if (input.sourceLanguage !== undefined) { sets.push("source_language = ?"); values.push(input.sourceLanguage); }

    this.db.prepare(`UPDATE translation_project_files SET ${sets.join(", ")} WHERE id = ?`).run(...values, fileId);

    logger.debug("translation-project:updateFile", { fileId, fields: Object.keys(input) });
    return this.getFile(fileId);
  }

  computeProjectConfidence(translationProjectId: string): { overallConfidence: number; deterministicPct: number } {
    const files = this.getFiles(translationProjectId);

    if (files.length === 0) {
      return { overallConfidence: 0, deterministicPct: 0 };
    }

    let totalLoc = 0;
    let weightedConfidence = 0;
    let deterministicLoc = 0;

    for (const file of files) {
      const loc = file.sourceCode.split("\n").length;
      totalLoc += loc;

      if (file.confidenceScore != null) {
        weightedConfidence += file.confidenceScore * loc;
      }

      if (file.deterministic === true) {
        deterministicLoc += loc;
      }
    }

    const overallConfidence = totalLoc > 0 ? weightedConfidence / totalLoc : 0;
    const deterministicPct = totalLoc > 0 ? (deterministicLoc / totalLoc) * 100 : 0;

    // Round to 4 decimal places for confidence, 2 for percentage
    return {
      overallConfidence: Math.round(overallConfidence * 10000) / 10000,
      deterministicPct: Math.round(deterministicPct * 100) / 100,
    };
  }
}
