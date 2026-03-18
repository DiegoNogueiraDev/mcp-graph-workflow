import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { STORE_DIR } from "../core/utils/constants.js";
import { readFileContent } from "../core/parser/file-reader.js";
import { extractEntities } from "../core/parser/extract.js";
import { convertToGraph } from "../core/importer/prd-to-graph.js";

describe("CLI import integration", () => {
  let tmpDir: string;
  let prdPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "mcp-import-test-"));
    const storeDir = path.join(tmpDir, STORE_DIR);
    mkdirSync(storeDir, { recursive: true });

    // Create a simple PRD file
    prdPath = path.join(tmpDir, "test.md");
    writeFileSync(
      prdPath,
      "# Test PRD\n## Epic: Authentication\n### Task: Login form\n- As a user I want to login\n### Task: Registration\n- As a user I want to register",
      "utf-8",
    );
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should read PRD file content", async () => {
    const result = await readFileContent(prdPath);
    expect(result.text).toContain("Test PRD");
    expect(result.text).toContain("Authentication");
    expect(result.originalName).toBe("test.md");
    expect(result.format).toBe(".md");
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it("should extract entities from PRD content", async () => {
    const { text } = await readFileContent(prdPath);
    const entities = extractEntities(text);
    expect(entities).toBeDefined();
    expect(entities.blocks.length).toBeGreaterThan(0);
    expect(entities.summary).toBeDefined();
    expect(typeof entities.summary.totalSections).toBe("number");
  });

  it("should convert entities to graph", async () => {
    const { text } = await readFileContent(prdPath);
    const entities = extractEntities(text);
    const graph = convertToGraph(entities, "test.md");
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThanOrEqual(0);
    expect(graph.stats).toBeDefined();
    expect(graph.stats.nodesCreated).toBe(graph.nodes.length);
    expect(graph.stats.edgesCreated).toBe(graph.edges.length);
  });

  it("should import into store", async () => {
    const store = SqliteStore.open(tmpDir);
    store.initProject("Test");

    const { text } = await readFileContent(prdPath);
    const entities = extractEntities(text);
    const graph = convertToGraph(entities, "test.md");

    store.bulkInsert(graph.nodes, graph.edges);

    const allNodes = store.getAllNodes();
    expect(allNodes.length).toBeGreaterThan(0);

    store.close();
  });

  it("should preserve node types from PRD extraction", async () => {
    const { text } = await readFileContent(prdPath);
    const entities = extractEntities(text);
    const graph = convertToGraph(entities, "test.md");

    const types = new Set(graph.nodes.map((n) => n.type));
    // Should have at least epic or task types from the PRD
    expect(types.size).toBeGreaterThan(0);
  });

  it("should set all nodes to backlog status", async () => {
    const { text } = await readFileContent(prdPath);
    const entities = extractEntities(text);
    const graph = convertToGraph(entities, "test.md");

    for (const node of graph.nodes) {
      expect(node.status).toBe("backlog");
    }
  });
});
