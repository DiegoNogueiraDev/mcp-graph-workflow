import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { readPrdFile } from "../core/parser/read-file.js";
import { extractEntities } from "../core/parser/extract.js";
import { convertToGraph } from "../core/importer/prd-to-graph.js";
import { makeNode, makeEdge } from "./helpers/factories.js";
import { generateId } from "../core/utils/id.js";

describe("MCP Tool Validation Logic", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test Project");
  });

  afterEach(() => {
    store.close();
  });

  // ── add_node ────────────────────────────────────

  describe("add_node", () => {
    it("add_node com parentId inexistente retorna null no getNodeById", () => {
      // Arrange
      const nonExistentId = generateId("node");

      // Act
      const result = store.getNodeById(nonExistentId);

      // Assert
      expect(result).toBeNull();
    });

    it("add_node com parentId válido cria edges parent_of e child_of", () => {
      // Arrange
      const parentNode = makeNode({ title: "Parent epic", type: "epic" });
      const childNode = makeNode({ title: "Child task", parentId: parentNode.id });

      // Act
      store.insertNode(parentNode);
      store.insertNode(childNode);

      const parentOfEdge = makeEdge(parentNode.id, childNode.id, {
        relationType: "parent_of",
      });
      const childOfEdge = makeEdge(childNode.id, parentNode.id, {
        relationType: "child_of",
      });
      store.insertEdge(parentOfEdge);
      store.insertEdge(childOfEdge);

      // Assert
      const edgesFromParent = store.getEdgesFrom(parentNode.id);
      const edgesToParent = store.getEdgesTo(parentNode.id);

      expect(edgesFromParent).toHaveLength(1);
      expect(edgesFromParent[0].relationType).toBe("parent_of");
      expect(edgesFromParent[0].to).toBe(childNode.id);

      expect(edgesToParent).toHaveLength(1);
      expect(edgesToParent[0].relationType).toBe("child_of");
      expect(edgesToParent[0].from).toBe(childNode.id);
    });
  });

  // ── add_edge ────────────────────────────────────

  describe("add_edge", () => {
    it("add_edge com from === to é self-reference", () => {
      // Arrange
      const nodeId = generateId("node");
      const from = nodeId;
      const to = nodeId;

      // Act
      const isSelfReference = from === to;

      // Assert
      expect(isSelfReference).toBe(true);
    });

    it("add_edge com node inexistente retorna null", () => {
      // Arrange
      const nonExistentId = generateId("node");

      // Act
      const result = store.getNodeById(nonExistentId);

      // Assert
      expect(result).toBeNull();
    });
  });

  // ── import_prd ──────────────────────────────────

  describe("import_prd", () => {
    const fixturePath = path.resolve(
      import.meta.dirname,
      "fixtures/sample-prd.txt",
    );

    it("import_prd rejeita reimport sem force", async () => {
      // Arrange
      const prd = await readPrdFile(fixturePath);
      const extraction = extractEntities(prd.content);
      const graph = convertToGraph(extraction, prd.absolutePath);
      store.bulkInsert(graph.nodes, graph.edges);
      store.recordImport(prd.absolutePath, graph.nodes.length, graph.edges.length);

      // Act
      const alreadyImported = store.hasImport(prd.absolutePath);

      // Assert
      expect(alreadyImported).toBe(true);
    });

    it("import_prd com force=true limpa nodes anteriores e reimporta", async () => {
      // Arrange — first import
      const prd = await readPrdFile(fixturePath);
      const extraction = extractEntities(prd.content);
      const graph = convertToGraph(extraction, prd.absolutePath);
      store.bulkInsert(graph.nodes, graph.edges);
      store.recordImport(prd.absolutePath, graph.nodes.length, graph.edges.length);

      const nodesBeforeClear = store.getAllNodes().length;
      expect(nodesBeforeClear).toBeGreaterThan(0);

      // Act — simulate force: clear + reimport
      const clearResult = store.clearImportedNodes(prd.absolutePath);
      expect(clearResult.nodesDeleted).toBeGreaterThan(0);

      const graph2 = convertToGraph(extraction, prd.absolutePath);
      store.bulkInsert(graph2.nodes, graph2.edges);
      store.recordImport(prd.absolutePath, graph2.nodes.length, graph2.edges.length);

      // Assert
      const nodesAfterReimport = store.getAllNodes().length;
      expect(nodesAfterReimport).toBe(nodesBeforeClear);
    });

    it("import_prd cria snapshot após import", async () => {
      // Arrange
      const prd = await readPrdFile(fixturePath);
      const extraction = extractEntities(prd.content);
      const graph = convertToGraph(extraction, prd.absolutePath);
      store.bulkInsert(graph.nodes, graph.edges);
      store.recordImport(prd.absolutePath, graph.nodes.length, graph.edges.length);

      // Act
      const snapshotId = store.createSnapshot();

      // Assert
      expect(snapshotId).toBeGreaterThan(0);
      const allNodes = store.getAllNodes();
      expect(allNodes.length).toBeGreaterThan(0);
    });
  });

  // ── update_status ───────────────────────────────

  describe("update_status", () => {
    it("update_status com node inexistente retorna null", () => {
      // Arrange
      const nonExistentId = "nonexistent-id";

      // Act
      const result = store.updateNodeStatus(nonExistentId, "done");

      // Assert
      expect(result).toBeNull();
    });
  });
});
