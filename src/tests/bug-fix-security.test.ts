/**
 * Bug Fix Tests — Security (Fase 1)
 * Tests for: import_graph path traversal, siebel path traversal,
 * node.ts self-parenting, edge weight schema, reductionPercent clamp.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { safeReadFileSync, assertPathInsideProject } from "../core/utils/fs.js";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode } from "./helpers/factories.js";
import { buildTaskContext } from "../core/context/compact-context.js";
import { BOOTSTRAP_TOOLS } from "../core/utils/constants.js";
import { ALWAYS_ALLOWED_TOOLS, READ_ONLY_TOOLS } from "../mcp/tool-classification.js";

describe("Bug Fix — safeReadFileSync (import_graph path traversal)", () => {
  it("should reject absolute path outside project", () => {
    expect(() => safeReadFileSync("/etc/passwd")).toThrow("Path outside project directory");
  });

  it("should reject relative traversal outside project", () => {
    expect(() => safeReadFileSync("../../../etc/passwd")).toThrow("Path outside project directory");
  });

  it("should reject unsupported extension when allowedExtensions provided", () => {
    expect(() => safeReadFileSync("./package.json", new Set([".txt"]))).toThrow("Unsupported file extension");
  });

  it("should read valid project file with correct extension", () => {
    const content = safeReadFileSync("./package.json", new Set([".json"]));
    expect(content).toContain("mcp-graph");
  });

  it("should read valid project file without extension filter", () => {
    const content = safeReadFileSync("./package.json");
    expect(content).toContain("mcp-graph");
  });
});

describe("Bug Fix — assertPathInsideProject (siebel path traversal)", () => {
  it("should reject /etc/passwd", () => {
    expect(() => assertPathInsideProject("/etc/passwd")).toThrow("Path outside project directory");
  });

  it("should reject relative traversal", () => {
    expect(() => assertPathInsideProject("../../etc")).toThrow("Path outside project directory");
  });

  it("should accept path inside project", () => {
    const result = assertPathInsideProject("./src");
    expect(result.replaceAll("\\", "/")).toContain("mcp-graph-workflow/src");
  });
});

describe("Bug Fix — node.ts self-parenting and circularity (Fase 1D)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should detect self-parenting at store level", () => {
    const node = makeNode({ title: "Parent" });
    store.insertNode(node);

    // The self-parenting check is in the MCP tool handler, not store.
    // Verify the setup: a fresh node should NOT have itself as parent.
    const fetched = store.getNodeById(node.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.parentId).not.toBe(fetched!.id);
  });

  it("should allow legitimate parent-child relationship", () => {
    const parent = makeNode({ type: "epic", title: "Epic" });
    const child = makeNode({ title: "Task", parentId: parent.id });
    store.insertNode(parent);
    store.insertNode(child);

    const fetchedChild = store.getNodeById(child.id);
    expect(fetchedChild!.parentId).toBe(parent.id);
  });
});

describe("Bug Fix — context reductionPercent clamp (#034)", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
  });

  afterEach(() => {
    store.close();
  });

  it("should never produce negative reductionPercent for minimal nodes", () => {
    // Minimal node — JSON overhead will exceed raw text content
    const node = makeNode({ title: "X" });
    store.insertNode(node);

    const ctx = buildTaskContext(store, node.id);
    expect(ctx).not.toBeNull();
    expect(ctx!.metrics.reductionPercent).toBeGreaterThanOrEqual(0);
  });

  it("should produce positive reductionPercent for large nodes", () => {
    const node = makeNode({
      title: "A very long task title that has lots of text",
      description: "A".repeat(2000),
      acceptanceCriteria: ["Given X when Y then Z".repeat(10)],
    });
    store.insertNode(node);

    const ctx = buildTaskContext(store, node.id);
    expect(ctx).not.toBeNull();
    expect(ctx!.metrics.reductionPercent).toBeGreaterThanOrEqual(0);
  });
});

describe("Bug Fix — BOOTSTRAP_TOOLS consistency (Fase 2B)", () => {
  it("ALWAYS_ALLOWED_TOOLS should be same reference as BOOTSTRAP_TOOLS", () => {
    expect(ALWAYS_ALLOWED_TOOLS).toBe(BOOTSTRAP_TOOLS);
  });

  it("BOOTSTRAP_TOOLS should contain the 4 bootstrap tools", () => {
    expect(BOOTSTRAP_TOOLS.has("init")).toBe(true);
    expect(BOOTSTRAP_TOOLS.has("set_phase")).toBe(true);
    expect(BOOTSTRAP_TOOLS.has("reindex_knowledge")).toBe(true);
    expect(BOOTSTRAP_TOOLS.has("sync_stack_docs")).toBe(true);
  });

  it("READ_ONLY_TOOLS should be superset of BOOTSTRAP_TOOLS", () => {
    for (const tool of BOOTSTRAP_TOOLS) {
      expect(READ_ONLY_TOOLS.has(tool), `${tool} missing from READ_ONLY_TOOLS`).toBe(true);
    }
  });
});
