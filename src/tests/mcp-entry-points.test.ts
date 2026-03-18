import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../mcp/app-factory.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { GraphEventBus } from "../core/events/event-bus.js";
import {
  buildLifecycleBlock,
  appendLifecycleToResponse,
} from "../mcp/lifecycle-wrapper.js";
import type { GraphDocument } from "../core/graph/graph-types.js";

// ── Helpers ──────────────────────────────────────────────

function makeDoc(
  nodes: Array<{ type: string; status: string; sprint?: string | null }> = [],
): GraphDocument {
  return {
    version: "1.0",
    project: {
      id: "proj_1",
      name: "test",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
    nodes: nodes.map((n, i) => ({
      id: `node_${i}`,
      type: n.type,
      title: `Node ${i}`,
      status: n.status,
      priority: 3 as const,
      sprint: n.sprint ?? null,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    })),
    edges: [],
    indexes: {
      byId: {},
      childrenByParent: {},
      incomingByNode: {},
      outgoingByNode: {},
    },
    meta: { sourceFiles: [], lastImport: null },
  } as unknown as GraphDocument;
}

// ── app-factory.ts ───────────────────────────────────────

describe("app-factory", () => {
  let store: SqliteStore;
  let eventBus: GraphEventBus;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(tmpdir(), `app-factory-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    store = SqliteStore.open(tmpDir);
    store.initProject("test-app");
    eventBus = new GraphEventBus();
  });

  afterEach(() => {
    store.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should return an express app", () => {
    const app = createApp({ store, basePath: tmpDir, eventBus });
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe("function");
  });

  it("should respond to health endpoint with ok", async () => {
    const app = createApp({ store, basePath: tmpDir, eventBus });
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, server: "mcp-graph" });
  });

  it("should mount API routes at /api/v1/stats", async () => {
    const app = createApp({ store, basePath: tmpDir, eventBus });
    const res = await request(app).get("/api/v1/stats");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalNodes");
  });

  it("should not have /mcp route when no mcp server is provided", async () => {
    const app = createApp({ store, basePath: tmpDir, eventBus });
    const res = await request(app).post("/mcp").send({});

    // Without MCP server, POST /mcp is not registered — falls through to 404 or static handler
    expect(res.status).not.toBe(200);
  });

  it("should accept storeManager option without error", () => {
    const app = createApp({
      store,
      basePath: tmpDir,
      eventBus,
      storeManager: undefined,
    });
    expect(app).toBeDefined();
  });
});

// ── lifecycle-wrapper.ts — buildLifecycleBlock ───────────

describe("buildLifecycleBlock", () => {
  it("should return phase, reminder, and suggestedNext", () => {
    const doc = makeDoc();
    const block = buildLifecycleBlock(doc);

    expect(block).toHaveProperty("phase");
    expect(block).toHaveProperty("reminder");
    expect(block).toHaveProperty("suggestedNext");
    expect(Array.isArray(block.suggestedNext)).toBe(true);
    expect(typeof block.reminder).toBe("string");
  });

  it("should return ANALYZE phase for empty graph", () => {
    const doc = makeDoc();
    const block = buildLifecycleBlock(doc);

    expect(block.phase).toBe("ANALYZE");
  });

  it("should return IMPLEMENT phase when tasks are in_progress", () => {
    const doc = makeDoc([{ type: "task", status: "in_progress", sprint: "s1" }]);
    const block = buildLifecycleBlock(doc);

    expect(block.phase).toBe("IMPLEMENT");
  });

  it("should include principles array", () => {
    const doc = makeDoc();
    const block = buildLifecycleBlock(doc);

    expect(Array.isArray(block.principles)).toBe(true);
    expect(block.principles.length).toBeGreaterThan(0);
  });

  it("should detect warnings when toolName is provided", () => {
    const doc = makeDoc();
    const block = buildLifecycleBlock(doc, {
      toolName: "update_status",
      mode: "strict",
    });

    expect(Array.isArray(block.warnings)).toBe(true);
    expect(block.warnings.length).toBeGreaterThan(0);
  });

  it("should return empty warnings when toolName is not provided", () => {
    const doc = makeDoc();
    const block = buildLifecycleBlock(doc);

    expect(block.warnings).toEqual([]);
  });

  it("should respect phaseOverride", () => {
    const doc = makeDoc();
    const block = buildLifecycleBlock(doc, { phaseOverride: "HANDOFF" });

    expect(block.phase).toBe("HANDOFF");
  });
});

// ── lifecycle-wrapper.ts — appendLifecycleToResponse ─────

describe("appendLifecycleToResponse", () => {
  it("should append _lifecycle to valid JSON response", () => {
    const doc = makeDoc();
    const original = JSON.stringify({ data: "test" });
    const result = appendLifecycleToResponse(original, doc);
    const parsed = JSON.parse(result);

    expect(parsed).toHaveProperty("data", "test");
    expect(parsed).toHaveProperty("_lifecycle");
    expect(parsed._lifecycle).toHaveProperty("phase");
  });

  it("should handle non-JSON response gracefully", () => {
    const doc = makeDoc();
    const result = appendLifecycleToResponse("plain text response", doc);

    expect(result).toContain("plain text response");
    expect(result).toContain("_lifecycle");
  });

  it("should preserve all original JSON fields", () => {
    const doc = makeDoc();
    const original = JSON.stringify({ a: 1, b: "two", c: [3] });
    const result = appendLifecycleToResponse(original, doc);
    const parsed = JSON.parse(result);

    expect(parsed.a).toBe(1);
    expect(parsed.b).toBe("two");
    expect(parsed.c).toEqual([3]);
  });
});

// ── init-project.ts — runInit ────────────────────────────

describe("runInit", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(tmpdir(), `init-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should create the store directory", async () => {
    const { runInit } = await import("../mcp/init-project.js");
    await runInit(tmpDir);

    const storeDir = path.join(tmpDir, "workflow-graph");
    expect(existsSync(storeDir)).toBe(true);
  });

  it("should create .mcp.json", async () => {
    const { runInit } = await import("../mcp/init-project.js");
    await runInit(tmpDir);

    const mcpJsonPath = path.join(tmpDir, ".mcp.json");
    expect(existsSync(mcpJsonPath)).toBe(true);

    const content = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
    expect(content).toHaveProperty("mcpServers");
  });

  it("should create .gitignore with workflow-graph/ entry", async () => {
    const { runInit } = await import("../mcp/init-project.js");
    await runInit(tmpDir);

    const gitignorePath = path.join(tmpDir, ".gitignore");
    expect(existsSync(gitignorePath)).toBe(true);

    const content = readFileSync(gitignorePath, "utf-8");
    expect(content).toContain("workflow-graph/");
  });

  it("should create CLAUDE.md with mcp-graph section", async () => {
    const { runInit } = await import("../mcp/init-project.js");
    await runInit(tmpDir);

    const claudeMdPath = path.join(tmpDir, "CLAUDE.md");
    expect(existsSync(claudeMdPath)).toBe(true);

    const content = readFileSync(claudeMdPath, "utf-8");
    expect(content).toContain("mcp-graph");
  });

  it("should create .vscode/mcp.json", async () => {
    const { runInit } = await import("../mcp/init-project.js");
    await runInit(tmpDir);

    const vscodeMcpPath = path.join(tmpDir, ".vscode", "mcp.json");
    expect(existsSync(vscodeMcpPath)).toBe(true);
  });
});
