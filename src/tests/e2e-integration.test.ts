/**
 * End-to-end integration tests: init → import_prd → list → next → update_status → stats
 * Decomposed into focused, isolated tests using the real parser pipeline.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { readPrdFile } from "../core/parser/read-file.js";
import { extractEntities } from "../core/parser/extract.js";
import { convertToGraph } from "../core/importer/prd-to-graph.js";
import { findNextTask } from "../core/planner/next-task.js";
import type { GraphNode, GraphEdge } from "../core/graph/graph-types.js";

const FIXTURE_PRD = path.resolve(
  import.meta.dirname,
  "fixtures/sample-prd.txt",
);

interface ImportResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: { nodesCreated: number; edgesCreated: number };
  sourceFileName: string;
}

async function importFixturePrd(store: SqliteStore): Promise<ImportResult> {
  store.initProject("E2E Test");
  const { content, absolutePath } = await readPrdFile(FIXTURE_PRD);
  const sourceFileName = path.basename(absolutePath);
  const extraction = extractEntities(content);
  const { nodes, edges, stats } = convertToGraph(extraction, sourceFileName);
  store.bulkInsert(nodes, edges);
  store.recordImport(sourceFileName, stats.nodesCreated, stats.edgesCreated);
  store.createSnapshot();
  return { nodes, edges, stats, sourceFileName };
}

describe("E2E: init → import → list → next → update_status → stats", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
  });

  afterEach(() => {
    store.close();
  });

  it("init + import cria quantidade correta de nodes e edges", async () => {
    // Arrange & Act
    const { stats } = await importFixturePrd(store);

    // Assert
    expect(stats.nodesCreated).toBeGreaterThan(0);
    expect(stats.edgesCreated).toBeGreaterThan(0);

    const allNodes = store.getAllNodes();
    expect(allNodes).toHaveLength(stats.nodesCreated);
  });

  it("nodes importados são filtráveis por type", async () => {
    // Arrange
    await importFixturePrd(store);

    // Act
    const tasks = store.getNodesByType("task");

    // Assert
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((n) => n.type === "task")).toBe(true);
  });

  it("next retorna task válida do grafo importado", async () => {
    // Arrange
    await importFixturePrd(store);

    // Act
    const doc = store.toGraphDocument();
    const nextResult = findNextTask(doc);

    // Assert
    expect(nextResult).not.toBeNull();
    expect(nextResult!.node.type).toMatch(/task|subtask/);
  });

  it("transições de status persistem corretamente", async () => {
    // Arrange
    await importFixturePrd(store);
    const doc = store.toGraphDocument();
    const nextResult = findNextTask(doc);
    expect(nextResult).not.toBeNull();
    const suggestedId = nextResult!.node.id;

    // Act & Assert — in_progress
    const inProgress = store.updateNodeStatus(suggestedId, "in_progress");
    expect(inProgress).not.toBeNull();
    expect(inProgress!.status).toBe("in_progress");

    // Act & Assert — done
    const done = store.updateNodeStatus(suggestedId, "done");
    expect(done).not.toBeNull();
    expect(done!.status).toBe("done");

    // Assert — persistence
    const showNode = store.getNodeById(suggestedId);
    expect(showNode).not.toBeNull();
    expect(showNode!.status).toBe("done");
  });

  it("stats refletem import e mudanças de status", async () => {
    // Arrange
    const { stats } = await importFixturePrd(store);
    const doc = store.toGraphDocument();
    const nextResult = findNextTask(doc);
    expect(nextResult).not.toBeNull();
    const suggestedId = nextResult!.node.id;

    // Act
    store.updateNodeStatus(suggestedId, "in_progress");
    store.updateNodeStatus(suggestedId, "done");
    const storeStats = store.getStats();

    // Assert
    expect(storeStats.totalNodes).toBe(stats.nodesCreated);
    expect(storeStats.totalEdges).toBe(stats.edgesCreated);
    expect(storeStats.byStatus["done"]).toBeGreaterThanOrEqual(1);
  });

  it("GraphDocument bridge é consistente com estado do store", async () => {
    // Arrange
    await importFixturePrd(store);
    const doc = store.toGraphDocument();
    const nextResult = findNextTask(doc);
    expect(nextResult).not.toBeNull();
    const suggestedId = nextResult!.node.id;

    // Act
    const graphDoc = store.toGraphDocument();

    // Assert
    expect(graphDoc.version).toBe("1.0.0");
    expect(graphDoc.project.name).toBe("E2E Test");
    expect(graphDoc.meta.sourceFiles).toContain("sample-prd.txt");
    expect(graphDoc.meta.lastImport).not.toBeNull();
    expect(graphDoc.indexes.byId[suggestedId]).toBeDefined();
  });

  it("import registra metadata", async () => {
    // Arrange & Act
    const { sourceFileName } = await importFixturePrd(store);

    // Assert
    const graphDoc = store.toGraphDocument();
    expect(graphDoc.meta.sourceFiles).toContain(sourceFileName);
    expect(graphDoc.meta.lastImport).not.toBeNull();
  });
});
