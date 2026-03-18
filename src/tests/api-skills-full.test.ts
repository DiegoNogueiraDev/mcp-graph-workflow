import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import type { Express } from "express";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { createSkillsRouter } from "../api/routes/skills.js";
import { errorHandler } from "../api/middleware/error-handler.js";
import type { StoreRef } from "../core/store/store-manager.js";

function createSkillsTestApp(): { app: Express; store: SqliteStore; storeRef: StoreRef } {
  const store = SqliteStore.open(":memory:");
  store.initProject("Test");
  const storeRef: StoreRef = { current: store };

  const app = express();
  app.use(express.json());
  app.use("/api/v1/skills", createSkillsRouter(() => process.cwd(), storeRef));
  app.use(errorHandler);

  return { app, store, storeRef };
}

describe("Skills API — full coverage", () => {
  let app: Express;
  let store: SqliteStore;

  beforeEach(() => {
    const ctx = createSkillsTestApp();
    app = ctx.app;
    store = ctx.store;
  });

  afterEach(() => {
    store.close();
  });

  // ── GET /skills ──────────────────────────────────────

  it("should return skills list with built-in source", async () => {
    const res = await request(app).get("/api/v1/skills");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("skills");
    expect(res.body).toHaveProperty("totalTokens");
    expect(Array.isArray(res.body.skills)).toBe(true);
    const builtIn = res.body.skills.filter(
      (s: { source: string }) => s.source === "built-in",
    );
    expect(builtIn.length).toBeGreaterThan(0);
  });

  it("should return empty custom skills when none created", async () => {
    const res = await request(app).get("/api/v1/skills?source=custom");
    expect(res.status).toBe(200);
    expect(res.body.skills).toEqual([]);
    expect(res.body.totalTokens).toBe(0);
  });

  it("should filter skills by phase", async () => {
    const res = await request(app).get("/api/v1/skills?phase=IMPLEMENT");
    expect(res.status).toBe(200);
    for (const skill of res.body.skills) {
      if (skill.phases) {
        expect(skill.phases).toContain("IMPLEMENT");
      }
    }
  });

  // ── GET /skills/preferences ──────────────────────────

  it("should return preferences object", async () => {
    const res = await request(app).get("/api/v1/skills/preferences");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("preferences");
    expect(typeof res.body.preferences).toBe("object");
  });

  // ── PATCH /skills/:name/preference ───────────────────

  it("should set skill preference enabled=false", async () => {
    const res = await request(app)
      .patch("/api/v1/skills/dev-flow-orchestrator/preference")
      .send({ enabled: false });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      name: "dev-flow-orchestrator",
      enabled: false,
    });

    // Verify persistence
    const prefsRes = await request(app).get("/api/v1/skills/preferences");
    expect(prefsRes.body.preferences["dev-flow-orchestrator"]).toBe(false);
  });

  it("should return 400 when enabled field is missing", async () => {
    const res = await request(app)
      .patch("/api/v1/skills/some-skill/preference")
      .send({ foo: "bar" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("enabled");
  });

  // ── POST /skills/custom ──────────────────────────────

  it("should create a custom skill", async () => {
    const body = {
      name: "my-custom-skill",
      description: "A test custom skill",
      category: "know-me",
      phases: ["IMPLEMENT"],
      instructions: "Do something specific",
    };
    const res = await request(app)
      .post("/api/v1/skills/custom")
      .send(body);
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("my-custom-skill");
    expect(res.body.description).toBe("A test custom skill");
    expect(res.body.id).toBeDefined();
    expect(res.body.projectId).toBeDefined();
  });

  it("should return 400 for invalid custom skill body", async () => {
    const res = await request(app)
      .post("/api/v1/skills/custom")
      .send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Validation failed");
    expect(res.body.details).toBeDefined();
  });

  // ── PUT /skills/custom/:id ───────────────────────────

  it("should update a custom skill", async () => {
    // Create first
    const createRes = await request(app)
      .post("/api/v1/skills/custom")
      .send({
        name: "updatable-skill",
        description: "Original description",
        phases: ["IMPLEMENT"],
        instructions: "Original instructions",
      });
    const skillId = createRes.body.id;

    const updateRes = await request(app)
      .put(`/api/v1/skills/custom/${skillId}`)
      .send({ description: "Updated description" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.description).toBe("Updated description");
    expect(updateRes.body.name).toBe("updatable-skill");
  });

  // ── DELETE /skills/custom/:id ────────────────────────

  it("should delete a custom skill", async () => {
    // Create first
    const createRes = await request(app)
      .post("/api/v1/skills/custom")
      .send({
        name: "deletable-skill",
        description: "To be deleted",
        phases: ["PLAN"],
        instructions: "Delete me",
      });
    const skillId = createRes.body.id;

    const deleteRes = await request(app).delete(
      `/api/v1/skills/custom/${skillId}`,
    );
    expect(deleteRes.status).toBe(204);

    // Verify it's gone
    const listRes = await request(app).get("/api/v1/skills?source=custom");
    const names = listRes.body.skills.map((s: { name: string }) => s.name);
    expect(names).not.toContain("deletable-skill");
  });

  it("should list custom skills after creation", async () => {
    await request(app)
      .post("/api/v1/skills/custom")
      .send({
        name: "listed-skill",
        description: "Appears in list",
        phases: ["ANALYZE"],
        instructions: "List me",
      });

    const res = await request(app).get("/api/v1/skills?source=custom");
    expect(res.status).toBe(200);
    expect(res.body.skills.length).toBe(1);
    expect(res.body.skills[0].name).toBe("listed-skill");
    expect(res.body.skills[0].source).toBe("custom");
    expect(res.body.skills[0].id).toBeDefined();
  });
});
