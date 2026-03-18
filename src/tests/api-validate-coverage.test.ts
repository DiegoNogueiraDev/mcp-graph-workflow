import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";

describe("Validate middleware — coverage via API routes", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  // validateBody is used on POST /project/init, POST /nodes, PATCH /nodes/:id, POST /edges

  it("should reject POST /project/init with invalid body", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/project/init")
      .send({ name: 123 }); // name must be string
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("should reject POST /nodes with missing required fields", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/nodes")
      .send({ title: "" }); // missing type, invalid title
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("should reject POST /edges with invalid relationType", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/edges")
      .send({ from: "a", to: "b", relationType: "invalid_type" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("should pass validation for valid POST /project/init body", async () => {
    // First close the existing project context to re-init
    const res = await request(ctx.app)
      .post("/api/v1/project/init")
      .send({ name: "Valid Project" });
    // Should not be a 400 validation error
    expect(res.status).not.toBe(400);
  });

  it("should reject PATCH /nodes/:id with invalid status", async () => {
    const res = await request(ctx.app)
      .patch("/api/v1/nodes/some-id")
      .send({ status: "invalid_status_value" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
