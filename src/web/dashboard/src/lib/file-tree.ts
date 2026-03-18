/**
 * Pure utility to convert a flat list of CodeSymbols into a hierarchical
 * file tree, using "/" in file paths as separators.
 * No React/DOM dependencies — fully testable.
 */
import type { CodeSymbol } from "./types.js";

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: FileTreeNode[];
  symbolCount: number;
  symbols: CodeSymbol[];
}

/**
 * Build a hierarchical file tree from a flat list of code symbols.
 * Symbols without a `file` field are skipped.
 * Directories are sorted before files; both sorted alphabetically.
 */
export function buildFileTree(symbols: CodeSymbol[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  // Group symbols by file
  const fileSymbols = new Map<string, CodeSymbol[]>();
  for (const sym of symbols) {
    if (!sym.file) continue;
    const existing = fileSymbols.get(sym.file);
    if (existing) {
      existing.push(sym);
    } else {
      fileSymbols.set(sym.file, [sym]);
    }
  }

  for (const [filePath, syms] of fileSymbols) {
    const parts = filePath.split("/");
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const path = parts.slice(0, i + 1).join("/");
      const isLeaf = i === parts.length - 1;

      let existing = currentLevel.find((n) => n.name === part);
      if (!existing) {
        existing = {
          name: part,
          path,
          isDirectory: !isLeaf,
          children: [],
          symbolCount: 0,
          symbols: [],
        };
        currentLevel.push(existing);
      }

      if (isLeaf) {
        existing.symbols = syms;
      }

      currentLevel = existing.children;
    }
  }

  // Compute symbol counts and sort recursively
  computeCountsAndSort(root);

  return root;
}

function computeCountsAndSort(nodes: FileTreeNode[]): number {
  let total = 0;
  for (const node of nodes) {
    if (node.isDirectory) {
      const childCount = computeCountsAndSort(node.children);
      node.symbolCount = childCount;
      total += childCount;
    } else {
      node.symbolCount = node.symbols.length;
      total += node.symbols.length;
      // Sort children of leaf too (should be empty, but safe)
      computeCountsAndSort(node.children);
    }
  }

  // Sort: directories first, then files, both alphabetical
  nodes.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return total;
}

/**
 * Filter a file tree by a search query (case-insensitive substring match on path).
 * Returns a new tree with only branches that match.
 */
export function filterTreeBySearch(tree: FileTreeNode[], query: string): FileTreeNode[] {
  if (!query.trim()) return tree;

  const lowerQuery = query.toLowerCase();
  return filterNodes(tree, lowerQuery);
}

function filterNodes(nodes: FileTreeNode[], query: string): FileTreeNode[] {
  const result: FileTreeNode[] = [];

  for (const node of nodes) {
    const pathMatches = node.path.toLowerCase().includes(query);

    if (pathMatches && !node.isDirectory) {
      // Leaf matches — include as-is
      result.push(node);
    } else if (node.isDirectory) {
      if (pathMatches) {
        // Directory name matches — include entire subtree
        result.push(node);
      } else {
        // Recurse into children
        const filteredChildren = filterNodes(node.children, query);
        if (filteredChildren.length > 0) {
          result.push({ ...node, children: filteredChildren });
        }
      }
    }
  }

  return result;
}
