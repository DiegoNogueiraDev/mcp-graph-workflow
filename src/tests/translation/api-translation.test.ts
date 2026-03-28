import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { createTranslationRouter } from "../../api/routes/translation.js";
import express from "express";
import request from "supertest";

// Minimal StoreRef mock with real DB
function createTestApp(): express.Express {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS ucr_categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT
    );
    CREATE TABLE IF NOT EXISTS ucr_constructs (
      id TEXT PRIMARY KEY, category_id TEXT NOT NULL, canonical_name TEXT NOT NULL UNIQUE,
      description TEXT, semantic_group TEXT, metadata TEXT DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS ucr_language_mappings (
      id TEXT PRIMARY KEY, construct_id TEXT NOT NULL, language_id TEXT NOT NULL,
      syntax_pattern TEXT, ast_node_type TEXT, confidence REAL NOT NULL DEFAULT 0.8,
      is_primary INTEGER NOT NULL DEFAULT 0, constraints TEXT DEFAULT '[]'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS ucr_constructs_fts USING fts5(
      canonical_name, description, semantic_group,
      content='ucr_constructs', content_rowid='rowid'
    );
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

  const storeRef = { current: { getDb: () => db, getProject: () => ({ id: "test-project" }) } };
  const app = express();
  app.use(express.json());
  app.use("/translation", createTranslationRouter(storeRef as never));
  return app;
}

describe("Translation API Routes", () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
  });

  describe("POST /translation/analyze", () => {
    it("should analyze source code and return analysis", async () => {
      const res = await request(app)
        .post("/translation/analyze")
        .send({ code: "function greet(name: string): void { console.log(name); }" })
        .expect(200);

      expect(res.body.detectedLanguage).toBe("typescript");
      expect(res.body.constructs).toBeDefined();
      expect(res.body.totalConstructs).toBeGreaterThan(0);
    });

    it("should return 400 for missing code", async () => {
      await request(app)
        .post("/translation/analyze")
        .send({})
        .expect(400);
    });
  });

  describe("POST /translation/jobs", () => {
    it("should create a job and return prompt", async () => {
      const res = await request(app)
        .post("/translation/jobs")
        .send({
          sourceCode: "const x: number = 1;",
          targetLanguage: "python",
          scope: "snippet",
        })
        .expect(201);

      expect(res.body.jobId).toBeTruthy();
      expect(res.body.prompt).toContain("python");
      expect(res.body.analysis).toBeDefined();
    });

    it("should return 400 for missing fields", async () => {
      await request(app)
        .post("/translation/jobs")
        .send({ sourceCode: "x" })
        .expect(400);
    });
  });

  describe("GET /translation/jobs", () => {
    it("should list jobs", async () => {
      // Create a job first
      await request(app)
        .post("/translation/jobs")
        .send({ sourceCode: "const x = 1;", targetLanguage: "python", scope: "snippet" });

      const res = await request(app).get("/translation/jobs").expect(200);
      expect(res.body.jobs).toBeInstanceOf(Array);
      expect(res.body.jobs.length).toBeGreaterThan(0);
    });
  });

  describe("GET /translation/jobs/:id", () => {
    it("should get a specific job", async () => {
      const createRes = await request(app)
        .post("/translation/jobs")
        .send({ sourceCode: "const x = 1;", targetLanguage: "python", scope: "snippet" });

      const res = await request(app)
        .get(`/translation/jobs/${createRes.body.jobId}`)
        .expect(200);

      expect(res.body.id).toBe(createRes.body.jobId);
    });

    it("should return 404 for non-existent job", async () => {
      await request(app).get("/translation/jobs/nonexistent").expect(404);
    });
  });

  describe("POST /translation/jobs/:id/finalize", () => {
    it("should finalize a job with generated code", async () => {
      const createRes = await request(app)
        .post("/translation/jobs")
        .send({ sourceCode: "function greet(): void {}", targetLanguage: "python", scope: "snippet" });

      const res = await request(app)
        .post(`/translation/jobs/${createRes.body.jobId}/finalize`)
        .send({ generatedCode: "def greet() -> None:\n    pass" })
        .expect(200);

      expect(res.body.job.status).toBe("done");
      expect(res.body.evidence).toBeDefined();
    });
  });

  describe("DELETE /translation/jobs/:id", () => {
    it("should delete a job", async () => {
      const createRes = await request(app)
        .post("/translation/jobs")
        .send({ sourceCode: "x = 1", targetLanguage: "python", scope: "snippet" });

      await request(app)
        .delete(`/translation/jobs/${createRes.body.jobId}`)
        .expect(204);
    });

    it("should return 404 for non-existent job", async () => {
      await request(app).delete("/translation/jobs/nonexistent").expect(404);
    });
  });

  describe("GET /translation/stats", () => {
    it("should return translation stats", async () => {
      const res = await request(app).get("/translation/stats").expect(200);
      expect(res.body.totalJobs).toBeDefined();
    });
  });
});
