import { describe, it, expect } from "vitest";
import {
  filterTopLevelNodes,
  TOP_LEVEL_TYPES,
} from "../web/dashboard/src/lib/graph-filters.js";
import {
  buildMemoryTree,
  type MemoryTreeNode,
} from "../web/dashboard/src/lib/memory-tree.js";
import {
  isCodeGraphData,
  isImpactResult,
} from "../web/dashboard/src/lib/code-graph-guards.js";

// ── Minimal factory ──────────────────────────────

interface TestNode {
  id: string;
  type: string;
  title: string;
  status: string;
  priority: number;
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

function makeNode(overrides: Partial<TestNode> & { id: string }): TestNode {
  return {
    type: "task",
    title: `Node ${overrides.id}`,
    status: "backlog",
    priority: 3,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── filterTopLevelNodes ──────────────────────────

describe("filterTopLevelNodes", () => {
  const nodes: TestNode[] = [
    makeNode({ id: "epic1", type: "epic", parentId: null }),
    makeNode({ id: "task1", type: "task", parentId: "epic1" }),
    makeNode({ id: "sub1", type: "subtask", parentId: "task1" }),
    makeNode({ id: "req1", type: "requirement", parentId: "epic1" }),
    makeNode({ id: "milestone1", type: "milestone", parentId: null }),
    makeNode({ id: "task2", type: "task" }),  // no parentId → root-level
    makeNode({ id: "constraint1", type: "constraint", parentId: "epic1" }),
    makeNode({ id: "risk1", type: "risk", parentId: "epic1" }),
    makeNode({ id: "decision1", type: "decision", parentId: "epic1" }),
    makeNode({ id: "ac1", type: "acceptance_criteria", parentId: "task1" }),
  ];

  it("should return only top-level types + nodes without parentId when showFullGraph=false", () => {
    const result = filterTopLevelNodes(nodes, false);
    const ids = result.map((n: TestNode) => n.id);
    expect(ids).toEqual(["epic1", "req1", "milestone1", "task2", "constraint1"]);
  });

  it("should return all nodes when showFullGraph=true", () => {
    const result = filterTopLevelNodes(nodes, true);
    expect(result).toHaveLength(10);
  });

  it("should return empty array for empty input", () => {
    expect(filterTopLevelNodes([], false)).toEqual([]);
  });

  it("should include tasks with no parentId (root-level)", () => {
    const rootTask = makeNode({ id: "root", type: "task" });
    const result = filterTopLevelNodes([rootTask], false);
    expect(result).toHaveLength(1);
  });

  it("should exclude non-top-level types with a parentId", () => {
    const child = makeNode({ id: "child", type: "task", parentId: "parent" });
    expect(filterTopLevelNodes([child], false)).toHaveLength(0);
  });
});

describe("TOP_LEVEL_TYPES", () => {
  it("should contain exactly epic, milestone, requirement, constraint", () => {
    expect(TOP_LEVEL_TYPES.has("epic")).toBe(true);
    expect(TOP_LEVEL_TYPES.has("milestone")).toBe(true);
    expect(TOP_LEVEL_TYPES.has("requirement")).toBe(true);
    expect(TOP_LEVEL_TYPES.has("constraint")).toBe(true);
    expect(TOP_LEVEL_TYPES.has("task")).toBe(false);
    expect(TOP_LEVEL_TYPES.has("subtask")).toBe(false);
  });

  it("should have exactly 4 entries", () => {
    expect(TOP_LEVEL_TYPES.size).toBe(4);
  });
});

// ── buildMemoryTree ──────────────────────────────

describe("buildMemoryTree", () => {
  it("should group memories by path prefix into a tree", () => {
    const memories = [
      { name: "core/store/migrations", content: "migration stuff" },
      { name: "core/store/sqlite", content: "sqlite stuff" },
      { name: "core/parser/segment", content: "segmenting" },
      { name: "api/routes", content: "routes info" },
    ];

    const tree = buildMemoryTree(memories);

    // Root level: "core" and "api"
    expect(tree).toHaveLength(2);
    expect(tree[0].name).toBe("core");
    expect(tree[1].name).toBe("api");

    // core/store has 2 children
    const store = tree[0].children.find((n: MemoryTreeNode) => n.name === "store");
    expect(store).toBeDefined();
    expect(store!.children).toHaveLength(2);
    expect(store!.children[0].name).toBe("migrations");
    expect(store!.children[0].memory?.content).toBe("migration stuff");
  });

  it("should handle single-segment names", () => {
    const memories = [{ name: "readme", content: "readme content" }];
    const tree = buildMemoryTree(memories);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("readme");
    expect(tree[0].memory?.content).toBe("readme content");
  });

  it("should handle empty input", () => {
    expect(buildMemoryTree([])).toEqual([]);
  });

  it("should preserve all memories as leaf nodes", () => {
    const memories = [
      { name: "a/b/c", content: "c" },
      { name: "a/b/d", content: "d" },
    ];
    const tree = buildMemoryTree(memories);

    const leafs: string[] = [];
    function collectLeafs(nodes: MemoryTreeNode[]): void {
      for (const n of nodes) {
        if (n.memory) leafs.push(n.memory.name);
        collectLeafs(n.children);
      }
    }
    collectLeafs(tree);
    expect(leafs).toEqual(["a/b/c", "a/b/d"]);
  });

  it("should build correct paths for each node", () => {
    const memories = [{ name: "a/b/c", content: "x" }];
    const tree = buildMemoryTree(memories);
    expect(tree[0].path).toBe("a");
    expect(tree[0].children[0].path).toBe("a/b");
    expect(tree[0].children[0].children[0].path).toBe("a/b/c");
  });
});

// ── isCodeGraphData ──────────────────────────────

describe("isCodeGraphData", () => {
  it("should return true for valid CodeGraphData", () => {
    expect(isCodeGraphData({ symbols: [], relations: [] })).toBe(true);
  });

  it("should return true with populated symbols", () => {
    expect(isCodeGraphData({ symbols: [{ name: "foo", kind: "function" }], relations: [] })).toBe(true);
  });

  it("should return false for null", () => {
    expect(isCodeGraphData(null)).toBe(false);
  });

  it("should return false for non-object", () => {
    expect(isCodeGraphData("string")).toBe(false);
  });

  it("should return false for object without symbols", () => {
    expect(isCodeGraphData({ relations: [] })).toBe(false);
  });

  it("should return false for object with non-array symbols", () => {
    expect(isCodeGraphData({ symbols: "not-array" })).toBe(false);
  });
});

// ── isImpactResult ───────────────────────────────

describe("isImpactResult", () => {
  it("should return true for valid ImpactResult", () => {
    expect(isImpactResult({ riskLevel: "low", affectedSymbols: [], symbol: "foo" })).toBe(true);
  });

  it("should return false for null", () => {
    expect(isImpactResult(null)).toBe(false);
  });

  it("should return false for object missing riskLevel", () => {
    expect(isImpactResult({ affectedSymbols: [] })).toBe(false);
  });

  it("should return false for object missing affectedSymbols", () => {
    expect(isImpactResult({ riskLevel: "low" })).toBe(false);
  });
});
