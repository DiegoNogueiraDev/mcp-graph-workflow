/**
 * Pure utility to convert a flat list of Serena memories into a
 * hierarchical folder tree, using "/" in memory names as path separators.
 * No React/DOM dependencies — fully testable.
 */

export interface MemoryTreeNode {
  name: string;
  path: string;
  children: MemoryTreeNode[];
  memory?: { name: string; content: string };
}

export function buildMemoryTree(
  memories: Array<{ name: string; content: string }>,
): MemoryTreeNode[] {
  const root: MemoryTreeNode[] = [];

  for (const mem of memories) {
    const parts = mem.name.split("/");
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const path = parts.slice(0, i + 1).join("/");
      const isLeaf = i === parts.length - 1;

      let existing = currentLevel.find((n) => n.name === part);
      if (!existing) {
        existing = { name: part, path, children: [] };
        if (isLeaf) existing.memory = mem;
        currentLevel.push(existing);
      }
      if (isLeaf && !existing.memory) {
        existing.memory = mem;
      }
      currentLevel = existing.children;
    }
  }

  return root;
}
