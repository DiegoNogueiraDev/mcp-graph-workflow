import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { readFileContent } from "../core/parser/file-reader.js";
import { extractEntities } from "../core/parser/extract.js";
import { convertToGraph } from "../core/importer/prd-to-graph.js";
import { findNextTask } from "../core/planner/next-task.js";
import { buildTaskContext } from "../core/context/compact-context.js";
import { graphToMermaid } from "../core/graph/mermaid-export.js";
import { searchNodes } from "../core/search/fts-search.js";
import { detectBottlenecks } from "../core/insights/bottleneck-detector.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "fixtures", "sample-prd.txt");

describe("Self-Test: mcp-graph indexes itself", () => {
  it("imports fixture PRD and creates graph with nodes and edges", async () => {
    const result = await readFileContent(fixturePath);
    const entities = extractEntities(result.text);
    const graph = convertToGraph(entities, fixturePath);

    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it("stores graph in in-memory SQLite and retrieves stats", async () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("self-test");

    const result = await readFileContent(fixturePath);
    const entities = extractEntities(result.text);
    const graph = convertToGraph(entities, fixturePath);
    store.bulkInsert(graph.nodes, graph.edges);

    const stats = store.getStats();
    expect(stats.totalNodes).toBeGreaterThan(0);
    expect(stats.totalEdges).toBeGreaterThan(0);

    store.close();
  });

  it("findNextTask returns a task from the graph", async () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("self-test");

    const result = await readFileContent(fixturePath);
    const entities = extractEntities(result.text);
    const graph = convertToGraph(entities, fixturePath);
    store.bulkInsert(graph.nodes, graph.edges);

    const doc = store.toGraphDocument();
    const next = findNextTask(doc);

    // Should find at least one task (fixture has tasks)
    if (doc.nodes.some((n) => n.type === "task" || n.type === "subtask")) {
      expect(next).not.toBeNull();
      expect(next?.node.type).toMatch(/^(task|subtask)$/);
      expect(next?.reason).toBeTruthy();
    }

    store.close();
  });

  it("buildTaskContext returns context with metrics", async () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("self-test");

    const result = await readFileContent(fixturePath);
    const entities = extractEntities(result.text);
    const graph = convertToGraph(entities, fixturePath);
    store.bulkInsert(graph.nodes, graph.edges);

    const firstTask = graph.nodes.find(
      (n) => n.type === "task" || n.type === "subtask",
    );
    if (firstTask) {
      const ctx = buildTaskContext(store, firstTask.id);
      expect(ctx).not.toBeNull();
      if (ctx) {
        expect(ctx.metrics).toBeDefined();
        expect(typeof ctx.metrics.estimatedTokens).toBe("number");
      }
    }

    store.close();
  });

  it("graphToMermaid generates valid mermaid syntax", async () => {
    const result = await readFileContent(fixturePath);
    const entities = extractEntities(result.text);
    const graph = convertToGraph(entities, fixturePath);

    const mermaid = graphToMermaid(graph.nodes, graph.edges);
    expect(mermaid).toBeTruthy();
    expect(mermaid.startsWith("graph") || mermaid.startsWith("mindmap")).toBe(
      true,
    );
  });

  it("searchNodes returns results for known term", async () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("self-test");

    const result = await readFileContent(fixturePath);
    const entities = extractEntities(result.text);
    const graph = convertToGraph(entities, fixturePath);
    store.bulkInsert(graph.nodes, graph.edges);

    // Search for a term that exists in the fixture
    const results = searchNodes(store, "MCP");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].node).toBeDefined();
    expect(results[0].score).toBeDefined();

    store.close();
  });

  it("detectBottlenecks returns valid report shape", async () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("self-test");

    const result = await readFileContent(fixturePath);
    const entities = extractEntities(result.text);
    const graph = convertToGraph(entities, fixturePath);
    store.bulkInsert(graph.nodes, graph.edges);

    const doc = store.toGraphDocument();
    const report = detectBottlenecks(doc);

    expect(report).toHaveProperty("blockedTasks");
    expect(report).toHaveProperty("criticalPath");
    expect(report).toHaveProperty("missingAcceptanceCriteria");
    expect(report).toHaveProperty("oversizedTasks");
    expect(Array.isArray(report.blockedTasks)).toBe(true);

    store.close();
  });

  it("full pipeline round-trip: import → plan → context → export", async () => {
    const store = SqliteStore.open(":memory:");
    store.initProject("self-test-roundtrip");

    // Import
    const result = await readFileContent(fixturePath);
    const entities = extractEntities(result.text);
    const graph = convertToGraph(entities, fixturePath);
    store.bulkInsert(graph.nodes, graph.edges);

    // Plan
    const doc = store.toGraphDocument();
    const next = findNextTask(doc);

    // Context (if there's a task)
    if (next) {
      const ctx = buildTaskContext(store, next.node.id);
      expect(ctx).not.toBeNull();
    }

    // Export
    const mermaid = graphToMermaid(graph.nodes, graph.edges);
    expect(mermaid.length).toBeGreaterThan(0);

    // Insights
    const report = detectBottlenecks(doc);
    expect(report).toBeDefined();

    store.close();
  });
});
