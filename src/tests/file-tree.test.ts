import { describe, it, expect } from "vitest";
import { buildFileTree, filterTreeBySearch } from "../web/dashboard/src/lib/file-tree.js";
import type { FileTreeNode } from "../web/dashboard/src/lib/file-tree.js";
import type { CodeSymbol } from "../web/dashboard/src/lib/types.js";

function makeSymbol(overrides: Partial<CodeSymbol> & { name: string }): CodeSymbol {
  return {
    kind: "function",
    ...overrides,
  };
}

describe("buildFileTree", () => {
  it("should return empty tree for empty symbols", () => {
    const result = buildFileTree([]);
    expect(result).toEqual([]);
  });

  it("should create directory chain for a single file", () => {
    const symbols: CodeSymbol[] = [
      makeSymbol({ name: "foo", kind: "function", file: "src/core/utils.ts" }),
    ];
    const tree = buildFileTree(symbols);

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("src");
    expect(tree[0].isDirectory).toBe(true);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].name).toBe("core");
    expect(tree[0].children[0].isDirectory).toBe(true);
    expect(tree[0].children[0].children).toHaveLength(1);

    const leaf = tree[0].children[0].children[0];
    expect(leaf.name).toBe("utils.ts");
    expect(leaf.isDirectory).toBe(false);
    expect(leaf.path).toBe("src/core/utils.ts");
    expect(leaf.symbols).toHaveLength(1);
    expect(leaf.symbols[0].name).toBe("foo");
  });

  it("should group multiple files in same directory as siblings", () => {
    const symbols: CodeSymbol[] = [
      makeSymbol({ name: "a", file: "src/foo.ts" }),
      makeSymbol({ name: "b", file: "src/bar.ts" }),
    ];
    const tree = buildFileTree(symbols);

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("src");
    expect(tree[0].children).toHaveLength(2);
    // Files should be sorted alphabetically
    expect(tree[0].children[0].name).toBe("bar.ts");
    expect(tree[0].children[1].name).toBe("foo.ts");
  });

  it("should aggregate symbolCount recursively", () => {
    const symbols: CodeSymbol[] = [
      makeSymbol({ name: "a", file: "src/core/a.ts" }),
      makeSymbol({ name: "b", file: "src/core/a.ts" }),
      makeSymbol({ name: "c", file: "src/utils/c.ts" }),
    ];
    const tree = buildFileTree(symbols);

    // root "src" should have symbolCount = 3
    expect(tree[0].symbolCount).toBe(3);
    // "core" dir should have 2
    const core = tree[0].children.find((c) => c.name === "core");
    expect(core?.symbolCount).toBe(2);
    // "a.ts" file should have 2 direct symbols
    const aFile = core?.children.find((c) => c.name === "a.ts");
    expect(aFile?.symbolCount).toBe(2);
    expect(aFile?.symbols).toHaveLength(2);
  });

  it("should skip symbols without file field", () => {
    const symbols: CodeSymbol[] = [
      makeSymbol({ name: "orphan", kind: "module" }),
      makeSymbol({ name: "withFile", file: "src/a.ts" }),
    ];
    const tree = buildFileTree(symbols);

    // Only "src/a.ts" should appear
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("src");
  });

  it("should sort directories before files, both alphabetically", () => {
    const symbols: CodeSymbol[] = [
      makeSymbol({ name: "x", file: "root/zebra.ts" }),
      makeSymbol({ name: "y", file: "root/alpha/y.ts" }),
      makeSymbol({ name: "z", file: "root/beta.ts" }),
    ];
    const tree = buildFileTree(symbols);
    const rootChildren = tree[0].children;

    // "alpha" dir first, then files alphabetically
    expect(rootChildren[0].name).toBe("alpha");
    expect(rootChildren[0].isDirectory).toBe(true);
    expect(rootChildren[1].name).toBe("beta.ts");
    expect(rootChildren[1].isDirectory).toBe(false);
    expect(rootChildren[2].name).toBe("zebra.ts");
    expect(rootChildren[2].isDirectory).toBe(false);
  });
});

describe("filterTreeBySearch", () => {
  function buildSampleTree(): FileTreeNode[] {
    return buildFileTree([
      makeSymbol({ name: "a", file: "src/core/store.ts" }),
      makeSymbol({ name: "b", file: "src/core/utils.ts" }),
      makeSymbol({ name: "c", file: "src/api/router.ts" }),
      makeSymbol({ name: "d", file: "src/api/routes/folder.ts" }),
    ]);
  }

  it("should return full tree when query is empty", () => {
    const tree = buildSampleTree();
    const filtered = filterTreeBySearch(tree, "");
    expect(filtered).toEqual(tree);
  });

  it("should filter by path substring (case-insensitive)", () => {
    const tree = buildSampleTree();
    const filtered = filterTreeBySearch(tree, "store");

    // Should keep only the branch leading to store.ts
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("src");
    const core = filtered[0].children.find((c) => c.name === "core");
    expect(core).toBeDefined();
    expect(core!.children).toHaveLength(1);
    expect(core!.children[0].name).toBe("store.ts");
  });

  it("should filter by directory name", () => {
    const tree = buildSampleTree();
    const filtered = filterTreeBySearch(tree, "api");

    expect(filtered).toHaveLength(1);
    const api = filtered[0].children.find((c) => c.name === "api");
    expect(api).toBeDefined();
    // All api children should be present
    expect(api!.children.length).toBeGreaterThanOrEqual(1);
  });

  it("should be case-insensitive", () => {
    const tree = buildSampleTree();
    const filtered = filterTreeBySearch(tree, "ROUTER");

    expect(filtered).toHaveLength(1);
    const api = filtered[0].children.find((c) => c.name === "api");
    expect(api).toBeDefined();
    const router = api!.children.find((c) => c.name === "router.ts");
    expect(router).toBeDefined();
  });

  it("should return empty array when nothing matches", () => {
    const tree = buildSampleTree();
    const filtered = filterTreeBySearch(tree, "nonexistent");
    expect(filtered).toEqual([]);
  });
});
