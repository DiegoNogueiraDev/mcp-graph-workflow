/**
 * Lifecycle Flow test: validates the complete lifecycle using the REAL pipeline.
 * readPrdFile → extractEntities → convertToGraph → SqliteStore → findNextTask
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { readPrdFile } from "../core/parser/read-file.js";
import { extractEntities } from "../core/parser/extract.js";
import { convertToGraph } from "../core/importer/prd-to-graph.js";
import { findNextTask } from "../core/planner/next-task.js";
import { graphToMermaid } from "../core/graph/mermaid-export.js";
import { makeNode } from "./helpers/factories.js";

const FIXTURE_PRD = path.resolve(
  import.meta.dirname,
  "fixtures/sample-prd.txt",
);

describe("Lifecycle Flow", () => {
  let store: SqliteStore;
  let importedNodesCount: number;
  let importedEdgesCount: number;

  beforeEach(async () => {
    store = SqliteStore.open(":memory:");
    store.initProject("Lifecycle Test");

    const { content, absolutePath } = await readPrdFile(FIXTURE_PRD);
    const sourceFileName = path.basename(absolutePath);
    const extraction = extractEntities(content);
    const { nodes, edges, stats } = convertToGraph(extraction, sourceFileName);

    importedNodesCount = stats.nodesCreated;
    importedEdgesCount = stats.edgesCreated;

    store.bulkInsert(nodes, edges);
    store.recordImport(sourceFileName, stats.nodesCreated, stats.edgesCreated);
    store.createSnapshot();
  });

  afterEach(() => {
    store.close();
  });

  // ── PLAN ──────────────────────────────────────────────

  it("import_prd cria nodes + edges a partir do fixture PRD", () => {
    const allNodes = store.getAllNodes();
    const doc = store.toGraphDocument();

    expect(allNodes.length).toBeGreaterThan(0);
    expect(doc.edges.length).toBeGreaterThan(0);
  });

  it("stats após import mostra todos como backlog", () => {
    const stats = store.getStats();
    const tasks = store.getNodesByType("task");
    const subtasks = store.getNodesByType("subtask");
    const taskAndSubtaskCount = tasks.length + subtasks.length;

    // byStatus.backlog counts ALL node types, so it equals totalNodes
    expect(stats.byStatus["backlog"]).toBe(stats.totalNodes);
    // Verify task+subtask nodes exist and are all backlog
    expect(taskAndSubtaskCount).toBeGreaterThan(0);
    const allTasksBacklog = [...tasks, ...subtasks].every((n) => n.status === "backlog");
    expect(allTasksBacklog).toBe(true);
  });

  // ── IMPLEMENT ─────────────────────────────────────────

  it("next() retorna a primeira task desbloqueada após import", () => {
    const doc = store.toGraphDocument();
    const result = findNextTask(doc);

    expect(result).not.toBeNull();
    expect(result!.node.type).toMatch(/task|subtask/);
  });

  it("update_status para in_progress marca a task corretamente", () => {
    const doc = store.toGraphDocument();
    const result = findNextTask(doc);
    expect(result).not.toBeNull();

    const updated = store.updateNodeStatus(result!.node.id, "in_progress");

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("in_progress");
  });

  it("update_status para done completa a task", () => {
    const doc = store.toGraphDocument();
    const result = findNextTask(doc);
    expect(result).not.toBeNull();

    store.updateNodeStatus(result!.node.id, "in_progress");
    const done = store.updateNodeStatus(result!.node.id, "done");

    expect(done).not.toBeNull();
    expect(done!.status).toBe("done");
  });

  it("next() após done retorna task diferente", () => {
    const doc1 = store.toGraphDocument();
    const first = findNextTask(doc1);
    expect(first).not.toBeNull();

    store.updateNodeStatus(first!.node.id, "done");

    const doc2 = store.toGraphDocument();
    const second = findNextTask(doc2);
    expect(second).not.toBeNull();
    expect(second!.node.id).not.toBe(first!.node.id);
  });

  it("completar todas as tasks faz next() retornar null", () => {
    // Complete tasks in dependency order by iterating: next → done → repeat
    let iterations = 0;
    const maxIterations = 100; // safety guard

    while (iterations < maxIterations) {
      const doc = store.toGraphDocument();
      const result = findNextTask(doc);
      if (result === null) break;

      store.updateNodeStatus(result.node.id, "done");
      iterations++;
    }

    const finalDoc = store.toGraphDocument();
    const finalNext = findNextTask(finalDoc);

    expect(finalNext).toBeNull();
    expect(iterations).toBeGreaterThan(0);
  });

  // ── VALIDATE ──────────────────────────────────────────

  it("stats mostra progresso correto durante as iterações", () => {
    const doc = store.toGraphDocument();
    const first = findNextTask(doc);
    expect(first).not.toBeNull();

    store.updateNodeStatus(first!.node.id, "done");

    const stats = store.getStats();
    expect(stats.byStatus["done"]).toBeGreaterThanOrEqual(1);
  });

  // ── HANDOFF ───────────────────────────────────────────

  it("bulk_update_status fecha todas as tasks restantes", () => {
    const tasks = store.getNodesByType("task");
    const subtasks = store.getNodesByType("subtask");
    const allTaskIds = [...tasks, ...subtasks].map((n) => n.id);

    const result = store.bulkUpdateStatus(allTaskIds, "done");

    expect(result.updated.length).toBe(allTaskIds.length);
    expect(result.notFound.length).toBe(0);

    const stats = store.getStats();
    const taskAndSubtaskCount = tasks.length + subtasks.length;
    expect(stats.byStatus["done"]).toBeGreaterThanOrEqual(taskAndSubtaskCount);
  });

  it("export_graph retorna document completo", () => {
    const doc = store.toGraphDocument();

    expect(doc.version).toBeDefined();
    expect(doc.project).toBeDefined();
    expect(doc.project.name).toBe("Lifecycle Test");
    expect(doc.nodes.length).toBeGreaterThan(0);
    expect(doc.edges.length).toBeGreaterThan(0);
  });

  it("export_mermaid gera diagrama válido", () => {
    const doc = store.toGraphDocument();
    const mermaid = graphToMermaid(doc.nodes, doc.edges);

    expect(mermaid).toContain("graph");
    expect(mermaid.length).toBeGreaterThan(0);
  });

  // ── LISTENING ─────────────────────────────────────────

  it("add_node cria feedback task no grafo existente", () => {
    const feedbackNode = makeNode({
      type: "task",
      title: "Feedback: melhorar parser",
      status: "backlog",
      priority: 2,
    });

    store.insertNode(feedbackNode);

    const allNodes = store.getAllNodes();
    const found = allNodes.find((n) => n.id === feedbackNode.id);

    expect(found).toBeDefined();
    expect(found!.title).toBe("Feedback: melhorar parser");
  });

  it("next() retorna a task de feedback recém-adicionada", () => {
    // Complete all existing tasks first
    let iterations = 0;
    const maxIterations = 100;

    while (iterations < maxIterations) {
      const doc = store.toGraphDocument();
      const result = findNextTask(doc);
      if (result === null) break;

      store.updateNodeStatus(result.node.id, "done");
      iterations++;
    }

    // Add a new feedback task
    const feedbackNode = makeNode({
      type: "task",
      title: "Feedback: melhorar parser",
      status: "backlog",
      priority: 1,
    });

    store.insertNode(feedbackNode);

    const doc = store.toGraphDocument();
    const next = findNextTask(doc);

    expect(next).not.toBeNull();
    expect(next!.node.id).toBe(feedbackNode.id);
  });
});
