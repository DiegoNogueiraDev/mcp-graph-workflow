/**
 * Unit tests for memory-tree.ts — buildMemoryTree.
 * Tests the actual production module via direct import.
 */
import { describe, it, expect } from "vitest";
import { buildMemoryTree, type MemoryTreeNode } from "../web/dashboard/src/lib/memory-tree.js";

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

    expect(tree).toHaveLength(2);
    expect(tree[0].name).toBe("core");
    expect(tree[1].name).toBe("api");

    const store = tree[0].children.find((n) => n.name === "store");
    expect(store).toBeDefined();
    expect(store!.children).toHaveLength(2);
    expect(store!.children[0].name).toBe("migrations");
    expect(store!.children[0].memory?.content).toBe("migration stuff");
    expect(store!.children[1].name).toBe("sqlite");
  });

  it("should handle single-segment memory names", () => {
    const memories = [{ name: "readme", content: "readme content" }];
    const tree = buildMemoryTree(memories);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("readme");
    expect(tree[0].path).toBe("readme");
    expect(tree[0].memory?.content).toBe("readme content");
    expect(tree[0].children).toEqual([]);
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

  it("should build correct paths for each level", () => {
    const memories = [{ name: "a/b/c", content: "x" }];
    const tree = buildMemoryTree(memories);
    expect(tree[0].path).toBe("a");
    expect(tree[0].children[0].path).toBe("a/b");
    expect(tree[0].children[0].children[0].path).toBe("a/b/c");
  });

  it("should share intermediate nodes between sibling paths", () => {
    const memories = [
      { name: "core/store/a", content: "a" },
      { name: "core/store/b", content: "b" },
      { name: "core/parser/c", content: "c" },
    ];
    const tree = buildMemoryTree(memories);

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("core");
    expect(tree[0].children).toHaveLength(2);
  });

  it("should not create duplicate intermediate nodes", () => {
    const memories = [
      { name: "x/y", content: "1" },
      { name: "x/z", content: "2" },
    ];
    const tree = buildMemoryTree(memories);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("x");
    expect(tree[0].children).toHaveLength(2);
  });

  it("should handle deeply nested paths", () => {
    const memories = [{ name: "a/b/c/d/e/f", content: "deep" }];
    const tree = buildMemoryTree(memories);

    let current = tree[0];
    const names = [current.name];
    while (current.children.length > 0) {
      current = current.children[0];
      names.push(current.name);
    }
    expect(names).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(current.memory?.content).toBe("deep");
  });

  it("should handle memory at intermediate and leaf level", () => {
    const memories = [
      { name: "core", content: "core readme" },
      { name: "core/store", content: "store readme" },
    ];
    const tree = buildMemoryTree(memories);

    expect(tree[0].memory?.content).toBe("core readme");
    expect(tree[0].children[0].memory?.content).toBe("store readme");
  });
});
