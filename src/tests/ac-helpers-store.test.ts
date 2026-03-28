import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { getNodeAcFromStore } from "../core/utils/ac-helpers.js";

describe("getNodeAcFromStore", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("AC Test");
  });

  it("should return inline AC when present", () => {
    store.insertNode({
      id: "t1",
      type: "task",
      title: "Task 1",
      status: "backlog",
      priority: 3,
      acceptanceCriteria: ["AC1", "AC2"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = getNodeAcFromStore(store, "t1");
    expect(result).toEqual(["AC1", "AC2"]);
  });

  it("should return child AC node titles when no inline AC", () => {
    store.insertNode({
      id: "t1",
      type: "task",
      title: "Task 1",
      status: "backlog",
      priority: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    store.insertNode({
      id: "ac1",
      type: "acceptance_criteria",
      title: "Given X When Y Then Z",
      status: "backlog",
      priority: 4,
      parentId: "t1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    store.insertNode({
      id: "ac2",
      type: "acceptance_criteria",
      title: "Should validate input",
      status: "backlog",
      priority: 4,
      parentId: "t1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = getNodeAcFromStore(store, "t1");
    expect(result).toEqual(["Given X When Y Then Z", "Should validate input"]);
  });

  it("should prefer inline AC over child AC nodes", () => {
    store.insertNode({
      id: "t1",
      type: "task",
      title: "Task 1",
      status: "backlog",
      priority: 3,
      acceptanceCriteria: ["Inline AC"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    store.insertNode({
      id: "ac1",
      type: "acceptance_criteria",
      title: "Child AC",
      status: "backlog",
      priority: 4,
      parentId: "t1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = getNodeAcFromStore(store, "t1");
    expect(result).toEqual(["Inline AC"]);
  });

  it("should return empty array for non-existent node", () => {
    const result = getNodeAcFromStore(store, "nope");
    expect(result).toEqual([]);
  });

  it("should return empty array when no AC of any kind", () => {
    store.insertNode({
      id: "t1",
      type: "task",
      title: "Task 1",
      status: "backlog",
      priority: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = getNodeAcFromStore(store, "t1");
    expect(result).toEqual([]);
  });

  it("should NOT call getAllNodes or getAllEdges (performance)", () => {
    store.insertNode({
      id: "t1",
      type: "task",
      title: "Task 1",
      status: "backlog",
      priority: 3,
      acceptanceCriteria: ["AC1"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Spy on getAllNodes/getAllEdges to verify they are NOT called
    let allNodesCalled = false;
    let allEdgesCalled = false;
    const origGetAllNodes = store.getAllNodes.bind(store);
    const origGetAllEdges = store.getAllEdges.bind(store);
    store.getAllNodes = () => { allNodesCalled = true; return origGetAllNodes(); };
    store.getAllEdges = () => { allEdgesCalled = true; return origGetAllEdges(); };

    getNodeAcFromStore(store, "t1");

    expect(allNodesCalled).toBe(false);
    expect(allEdgesCalled).toBe(false);
  });
});
