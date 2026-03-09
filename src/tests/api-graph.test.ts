import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createTestApp, type TestContext } from "./helpers/test-app.js";
import { generateId } from "../core/utils/id.js";
import { now } from "../core/utils/time.js";
import type { GraphEdge } from "../core/graph/graph-types.js";
import { makeNode } from "./helpers/factories.js";

describe("API /api/v1/graph", () => {
  let ctx: TestContext;

  beforeEach(() => {
    ctx = createTestApp();
  });

  afterEach(() => {
    ctx.store.close();
  });

  describe("GET /api/v1/graph", () => {
    it("should return full graph document", async () => {
      const node = makeNode();
      ctx.store.insertNode(node);

      const res = await request(ctx.app).get("/api/v1/graph");

      expect(res.status).toBe(200);
      expect(res.body.version).toBe("1.0.0");
      expect(res.body.project).toBeDefined();
      expect(res.body.nodes).toHaveLength(1);
      expect(res.body.edges).toHaveLength(0);
      expect(res.body.indexes).toBeDefined();
      expect(res.body.meta).toBeDefined();
    });
  });

  describe("GET /api/v1/graph/mermaid", () => {
    it("should return mermaid flowchart", async () => {
      const nodeA = makeNode({ title: "Task A" });
      const nodeB = makeNode({ title: "Task B" });
      ctx.store.insertNode(nodeA);
      ctx.store.insertNode(nodeB);

      const edge: GraphEdge = {
        id: generateId("edge"),
        from: nodeA.id,
        to: nodeB.id,
        relationType: "depends_on",
        createdAt: now(),
      };
      ctx.store.insertEdge(edge);

      const res = await request(ctx.app).get("/api/v1/graph/mermaid");

      expect(res.status).toBe(200);
      expect(res.type).toBe("text/plain");
      expect(res.text).toContain("graph TD");
      expect(res.text).toContain("Task A");
      expect(res.text).toContain("Task B");
      expect(res.text).toContain("depends_on");
    });

    it("should support LR direction", async () => {
      const node = makeNode();
      ctx.store.insertNode(node);

      const res = await request(ctx.app).get("/api/v1/graph/mermaid?direction=LR");

      expect(res.status).toBe(200);
      expect(res.text).toContain("graph LR");
    });

    it("should support mindmap format", async () => {
      const node = makeNode({ title: "Root task" });
      ctx.store.insertNode(node);

      const res = await request(ctx.app).get("/api/v1/graph/mermaid?format=mindmap");

      expect(res.status).toBe(200);
      expect(res.text).toContain("mindmap");
    });

    it("should filter by status", async () => {
      ctx.store.insertNode(makeNode({ title: "Done task", status: "done" }));
      ctx.store.insertNode(makeNode({ title: "Backlog task", status: "backlog" }));

      const res = await request(ctx.app).get("/api/v1/graph/mermaid?status=done");

      expect(res.status).toBe(200);
      expect(res.text).toContain("Done task");
      expect(res.text).not.toContain("Backlog task");
    });
  });

  describe("GET /api/v1/stats", () => {
    it("should return stats", async () => {
      ctx.store.insertNode(makeNode({ type: "task", status: "backlog" }));
      ctx.store.insertNode(makeNode({ type: "epic", status: "done" }));

      const res = await request(ctx.app).get("/api/v1/stats");

      expect(res.status).toBe(200);
      expect(res.body.totalNodes).toBe(2);
      expect(res.body.totalEdges).toBe(0);
      expect(res.body.byType.task).toBe(1);
      expect(res.body.byType.epic).toBe(1);
      expect(res.body.byStatus.backlog).toBe(1);
      expect(res.body.byStatus.done).toBe(1);
    });
  });

  describe("GET /api/v1/search", () => {
    it("should search nodes by query", async () => {
      ctx.store.insertNode(makeNode({ title: "Authentication module" }));
      ctx.store.insertNode(makeNode({ title: "Database migration" }));

      const res = await request(ctx.app).get("/api/v1/search?q=authentication");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe("Authentication module");
    });

    it("should return 400 when query is missing", async () => {
      const res = await request(ctx.app).get("/api/v1/search");

      expect(res.status).toBe(400);
    });
  });
});
