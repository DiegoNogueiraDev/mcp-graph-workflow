import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { makeNode, makeEdge } from "./helpers/factories.js";

describe("SqliteStore — import deduplication", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Dedup Test");
  });

  afterEach(() => {
    store.close();
  });

  // ── hasImport ───────────────────────────────

  it("returns false when no imports exist", () => {
    expect(store.hasImport("prd.md")).toBe(false);
  });

  it("returns true after recording an import", () => {
    store.recordImport("prd.md", 5, 3);
    expect(store.hasImport("prd.md")).toBe(true);
  });

  it("returns false for a different file name", () => {
    store.recordImport("prd.md", 5, 3);
    expect(store.hasImport("other.md")).toBe(false);
  });

  // ── clearImportedNodes ──────────────────────

  it("clears nodes from a specific source file", () => {
    const n1 = makeNode({ sourceRef: { file: "prd.md" } });
    const n2 = makeNode({ sourceRef: { file: "prd.md" } });
    const n3 = makeNode({ sourceRef: { file: "other.md" } });
    store.insertNode(n1);
    store.insertNode(n2);
    store.insertNode(n3);
    store.recordImport("prd.md", 2, 0);
    store.recordImport("other.md", 1, 0);

    const result = store.clearImportedNodes("prd.md");
    expect(result.nodesDeleted).toBe(2);

    // n3 from other.md should still exist
    expect(store.getAllNodes()).toHaveLength(1);
    expect(store.getNodeById(n3.id)).not.toBeNull();
  });

  it("clears edges associated with deleted nodes", () => {
    const n1 = makeNode({ sourceRef: { file: "prd.md" } });
    const n2 = makeNode({ sourceRef: { file: "prd.md" } });
    const n3 = makeNode({ sourceRef: { file: "other.md" } });
    store.insertNode(n1);
    store.insertNode(n2);
    store.insertNode(n3);

    store.insertEdge(makeEdge(n1.id, n2.id));
    store.insertEdge(makeEdge(n1.id, n3.id));
    store.recordImport("prd.md", 2, 2);

    const result = store.clearImportedNodes("prd.md");
    expect(result.edgesDeleted).toBe(2);
    expect(store.getAllEdges()).toHaveLength(0);
  });

  it("clears import history for the source file", () => {
    store.recordImport("prd.md", 5, 3);
    expect(store.hasImport("prd.md")).toBe(true);

    store.clearImportedNodes("prd.md");
    expect(store.hasImport("prd.md")).toBe(false);
  });

  it("returns zero counts when no matching nodes exist", () => {
    store.recordImport("prd.md", 0, 0);
    const result = store.clearImportedNodes("prd.md");
    expect(result.nodesDeleted).toBe(0);
    expect(result.edgesDeleted).toBe(0);
  });

  // ── Sprint filter (list tool) ───────────────

  it("nodes can be filtered by sprint via store methods", () => {
    const n1 = makeNode({ sprint: "sprint-1" });
    const n2 = makeNode({ sprint: "sprint-2" });
    const n3 = makeNode({ sprint: "sprint-1" });
    store.insertNode(n1);
    store.insertNode(n2);
    store.insertNode(n3);

    const allNodes = store.getAllNodes();
    const sprint1 = allNodes.filter((n) => n.sprint === "sprint-1");
    const sprint2 = allNodes.filter((n) => n.sprint === "sprint-2");

    expect(sprint1).toHaveLength(2);
    expect(sprint2).toHaveLength(1);
  });
});
