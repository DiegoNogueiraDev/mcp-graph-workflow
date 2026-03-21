import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestApp } from "./helpers/test-app.js";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import type { Express } from "express";

describe("Journey API", () => {
  let app: Express;
  let testJourneyDir: string;

  beforeEach(() => {
    const result = createTestApp();
    app = result.app;
    // Create temp journey directory
    testJourneyDir = path.join("/tmp", `journey-test-${Date.now()}`);
    fs.mkdirSync(path.join(testJourneyDir, "journey-screenshots"), { recursive: true });
  });

  afterEach(() => {
    if (testJourneyDir && fs.existsSync(testJourneyDir)) {
      fs.rmSync(testJourneyDir, { recursive: true, force: true });
    }
  });

  describe("GET /journey/maps", () => {
    it("should return empty list when no journey maps exist", async () => {
      const res = await request(app).get("/api/v1/journey/maps");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ maps: [] });
    });
  });

  describe("POST /journey/maps", () => {
    it("should create a new journey map", async () => {
      const journeyData = {
        name: "Test Journey",
        url: "https://example.com",
        description: "A test journey mapping",
      };

      const res = await request(app)
        .post("/api/v1/journey/maps")
        .send(journeyData);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: "Test Journey",
        url: "https://example.com",
        description: "A test journey mapping",
        createdAt: expect.any(String),
      });
    });

    it("should reject invalid input", async () => {
      const res = await request(app)
        .post("/api/v1/journey/maps")
        .send({ name: "" });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /journey/maps/:id", () => {
    it("should return a journey map with screens and edges", async () => {
      // Create a journey map
      const createRes = await request(app)
        .post("/api/v1/journey/maps")
        .send({ name: "Test", url: "https://example.com" });
      const mapId = createRes.body.id;

      // Add a screen
      await request(app)
        .post(`/api/v1/journey/maps/${mapId}/screens`)
        .send({
          title: "Homepage",
          url: "https://example.com/",
          screenType: "landing",
          description: "Main landing page",
        });

      const res = await request(app).get(`/api/v1/journey/maps/${mapId}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: mapId,
        name: "Test",
        screens: expect.any(Array),
        edges: expect.any(Array),
      });
      expect(res.body.screens.length).toBe(1);
      expect(res.body.screens[0].title).toBe("Homepage");
    });

    it("should return 404 for non-existent map", async () => {
      const res = await request(app).get("/api/v1/journey/maps/non-existent");
      expect(res.status).toBe(404);
    });
  });

  describe("POST /journey/maps/:id/screens", () => {
    it("should add a screen to a journey map", async () => {
      const createRes = await request(app)
        .post("/api/v1/journey/maps")
        .send({ name: "Test", url: "https://example.com" });
      const mapId = createRes.body.id;

      const screenData = {
        title: "Login Page",
        url: "https://example.com/login",
        screenType: "form",
        description: "User login form",
        fields: [
          { name: "email", type: "email", required: true, label: "Email" },
          { name: "password", type: "password", required: true, label: "Password" },
        ],
        ctas: ["Sign In", "Forgot Password"],
      };

      const res = await request(app)
        .post(`/api/v1/journey/maps/${mapId}/screens`)
        .send(screenData);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        title: "Login Page",
        screenType: "form",
        fields: expect.any(Array),
      });
    });
  });

  describe("POST /journey/maps/:id/edges", () => {
    it("should create an edge between two screens", async () => {
      const createRes = await request(app)
        .post("/api/v1/journey/maps")
        .send({ name: "Test", url: "https://example.com" });
      const mapId = createRes.body.id;

      // Create two screens
      const s1 = await request(app)
        .post(`/api/v1/journey/maps/${mapId}/screens`)
        .send({ title: "Home", url: "/", screenType: "landing" });
      const s2 = await request(app)
        .post(`/api/v1/journey/maps/${mapId}/screens`)
        .send({ title: "Login", url: "/login", screenType: "form" });

      const res = await request(app)
        .post(`/api/v1/journey/maps/${mapId}/edges`)
        .send({
          from: s1.body.id,
          to: s2.body.id,
          label: "CTA: Sign In",
          type: "navigation",
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        from: s1.body.id,
        to: s2.body.id,
        label: "CTA: Sign In",
      });
    });
  });

  describe("DELETE /journey/maps/:id", () => {
    it("should delete a journey map", async () => {
      const createRes = await request(app)
        .post("/api/v1/journey/maps")
        .send({ name: "Test", url: "https://example.com" });
      const mapId = createRes.body.id;

      const res = await request(app).delete(`/api/v1/journey/maps/${mapId}`);
      expect(res.status).toBe(204);

      const getRes = await request(app).get(`/api/v1/journey/maps/${mapId}`);
      expect(getRes.status).toBe(404);
    });
  });

  describe("POST /journey/maps/import", () => {
    it("should import a journey map from JSON", async () => {
      const journeyMap = {
        journey: {
          name: "ClickPlanos",
          url: "https://www.clickplanos.com.br",
          description: "Health plan marketplace journey",
        },
        screens: [
          {
            id: "screen-01",
            title: "Homepage",
            screenshot: "01-homepage.png",
            url: "https://www.clickplanos.com.br/",
            screenType: "landing",
            fields: [],
            ctas: ["Simular"],
          },
          {
            id: "screen-02",
            title: "Form",
            screenshot: "02-form.png",
            url: "https://www.clickplanos.com.br/form",
            screenType: "form",
            fields: [{ name: "nome", type: "text", required: true, label: "Nome" }],
            ctas: ["Submit"],
          },
        ],
        edges: [
          { from: "screen-01", to: "screen-02", label: "CTA: Simular", type: "navigation" },
        ],
        variants: {
          A: { name: "Direct", path: ["screen-01", "screen-02"] },
        },
      };

      const res = await request(app)
        .post("/api/v1/journey/maps/import")
        .send(journeyMap);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        screensCreated: 2,
        edgesCreated: 1,
      });
    });
  });

  describe("GET /journey/screenshots/:mapId/:filename", () => {
    it("should return 404 for non-existent screenshot", async () => {
      const res = await request(app).get("/api/v1/journey/screenshots/fake-map/fake.png");
      expect(res.status).toBe(404);
    });
  });
});
