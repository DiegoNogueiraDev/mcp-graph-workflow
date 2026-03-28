import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { TranslationStore } from "../../core/translation/translation-store.js";
import type { TranslationJob } from "../../core/translation/translation-types.js";

function createDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS translation_jobs (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
      source_language TEXT NOT NULL, target_language TEXT NOT NULL,
      source_code TEXT NOT NULL, target_code TEXT,
      status TEXT NOT NULL DEFAULT 'pending', scope TEXT NOT NULL DEFAULT 'snippet',
      constraints TEXT, analysis TEXT, result TEXT, evidence TEXT,
      confidence_score REAL, warnings TEXT, error_message TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);
  return db;
}

describe("TranslationStore", () => {
  let db: Database.Database;
  let store: TranslationStore;

  beforeEach(() => {
    db = createDb();
    store = new TranslationStore(db);
  });

  describe("createJob", () => {
    it("should create a job and return it with an ID", () => {
      const job = store.createJob({
        projectId: "proj-1",
        sourceLanguage: "typescript",
        targetLanguage: "python",
        sourceCode: "function greet() {}",
        scope: "snippet",
      });

      expect(job.id).toBeTruthy();
      expect(job.projectId).toBe("proj-1");
      expect(job.sourceLanguage).toBe("typescript");
      expect(job.targetLanguage).toBe("python");
      expect(job.status).toBe("pending");
      expect(job.createdAt).toBeTruthy();
    });
  });

  describe("getJob", () => {
    it("should retrieve a job by ID", () => {
      const created = store.createJob({
        projectId: "proj-1",
        sourceLanguage: "typescript",
        targetLanguage: "python",
        sourceCode: "const x = 1;",
        scope: "snippet",
      });
      const found = store.getJob(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.sourceCode).toBe("const x = 1;");
    });

    it("should return null for non-existent ID", () => {
      expect(store.getJob("non-existent")).toBeNull();
    });
  });

  describe("listJobs", () => {
    it("should list all jobs for a project", () => {
      store.createJob({ projectId: "proj-1", sourceLanguage: "typescript", targetLanguage: "python", sourceCode: "a", scope: "snippet" });
      store.createJob({ projectId: "proj-1", sourceLanguage: "python", targetLanguage: "go", sourceCode: "b", scope: "function" });
      store.createJob({ projectId: "proj-2", sourceLanguage: "go", targetLanguage: "rust", sourceCode: "c", scope: "snippet" });

      const jobs = store.listJobs("proj-1");
      expect(jobs).toHaveLength(2);
    });

    it("should return empty array for project with no jobs", () => {
      expect(store.listJobs("nonexistent")).toHaveLength(0);
    });
  });

  describe("updateJob", () => {
    it("should update status and target code", () => {
      const job = store.createJob({ projectId: "p1", sourceLanguage: "ts", targetLanguage: "py", sourceCode: "x", scope: "snippet" });

      const updated = store.updateJob(job.id, {
        status: "done",
        targetCode: "def x(): pass",
        confidenceScore: 0.85,
      });

      expect(updated).not.toBeNull();
      expect(updated!.status).toBe("done");
      expect(updated!.targetCode).toBe("def x(): pass");
      expect(updated!.confidenceScore).toBe(0.85);
    });

    it("should return null for non-existent ID", () => {
      expect(store.updateJob("nonexistent", { status: "done" })).toBeNull();
    });
  });

  describe("deleteJob", () => {
    it("should delete a job", () => {
      const job = store.createJob({ projectId: "p1", sourceLanguage: "ts", targetLanguage: "py", sourceCode: "x", scope: "snippet" });
      const deleted = store.deleteJob(job.id);
      expect(deleted).toBe(true);
      expect(store.getJob(job.id)).toBeNull();
    });

    it("should return false for non-existent ID", () => {
      expect(store.deleteJob("nonexistent")).toBe(false);
    });
  });

  describe("getJobsByLanguagePair", () => {
    it("should find jobs by source/target language", () => {
      store.createJob({ projectId: "p1", sourceLanguage: "typescript", targetLanguage: "python", sourceCode: "a", scope: "snippet" });
      store.createJob({ projectId: "p1", sourceLanguage: "typescript", targetLanguage: "python", sourceCode: "b", scope: "snippet" });
      store.createJob({ projectId: "p1", sourceLanguage: "python", targetLanguage: "go", sourceCode: "c", scope: "snippet" });

      const tsToPy = store.getJobsByLanguagePair("p1", "typescript", "python");
      expect(tsToPy).toHaveLength(2);

      const pyToGo = store.getJobsByLanguagePair("p1", "python", "go");
      expect(pyToGo).toHaveLength(1);
    });
  });
});
