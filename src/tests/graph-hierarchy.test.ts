import { describe, it, expect } from 'vitest';
import {
  buildChildrenMap,
  getRootNodes,
  getVisibleNodes,
  buildHierarchyTree,
  hasExpandableChildren,
  getChildCount,
} from '../web/dashboard/src/lib/graph-hierarchy.js';

// Minimal factory — only fields the hierarchy functions care about
function makeNode(overrides: {
  id: string;
  parentId?: string | null;
  type?: string;
  title?: string;
  status?: string;
}) {
  return {
    id: overrides.id,
    type: overrides.type ?? 'task',
    title: overrides.title ?? overrides.id,
    status: overrides.status ?? 'backlog',
    priority: 3,
    parentId: overrides.parentId ?? null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  } as import('../web/dashboard/src/lib/types.js').GraphNode;
}

function makeEdge(overrides: {
  id?: string;
  from: string;
  to: string;
  relationType?: string;
}) {
  return {
    id: overrides.id ?? `${overrides.from}-${overrides.to}`,
    from: overrides.from,
    to: overrides.to,
    relationType: overrides.relationType ?? 'parent_of',
    createdAt: '2025-01-01T00:00:00Z',
  } as import('../web/dashboard/src/lib/types.js').GraphEdge;
}

describe('buildChildrenMap', () => {
  it('should build map from parentId relationships', () => {
    const nodes = [
      makeNode({ id: 'epic-1' }),
      makeNode({ id: 'task-1', parentId: 'epic-1' }),
      makeNode({ id: 'task-2', parentId: 'epic-1' }),
    ];
    const map = buildChildrenMap(nodes, []);
    expect(map.get('epic-1')).toEqual(['task-1', 'task-2']);
    expect(map.has('task-1')).toBe(false);
  });

  it('should build map from parent_of edges', () => {
    const nodes = [
      makeNode({ id: 'epic-1' }),
      makeNode({ id: 'task-1' }),
    ];
    const edges = [makeEdge({ from: 'epic-1', to: 'task-1', relationType: 'parent_of' })];
    const map = buildChildrenMap(nodes, edges);
    expect(map.get('epic-1')).toEqual(['task-1']);
  });

  it('should build map from child_of edges (reverse)', () => {
    const nodes = [
      makeNode({ id: 'epic-1' }),
      makeNode({ id: 'task-1' }),
    ];
    const edges = [makeEdge({ from: 'task-1', to: 'epic-1', relationType: 'child_of' })];
    const map = buildChildrenMap(nodes, edges);
    expect(map.get('epic-1')).toEqual(['task-1']);
  });

  it('should deduplicate children from parentId + edges', () => {
    const nodes = [
      makeNode({ id: 'epic-1' }),
      makeNode({ id: 'task-1', parentId: 'epic-1' }),
    ];
    const edges = [makeEdge({ from: 'epic-1', to: 'task-1', relationType: 'parent_of' })];
    const map = buildChildrenMap(nodes, edges);
    expect(map.get('epic-1')).toEqual(['task-1']);
  });

  it('should return empty map for flat nodes', () => {
    const nodes = [makeNode({ id: 'a' }), makeNode({ id: 'b' })];
    const map = buildChildrenMap(nodes, []);
    expect(map.size).toBe(0);
  });
});

describe('getRootNodes', () => {
  it('should return nodes without parentId', () => {
    const nodes = [
      makeNode({ id: 'epic-1' }),
      makeNode({ id: 'task-1', parentId: 'epic-1' }),
      makeNode({ id: 'epic-2' }),
    ];
    const roots = getRootNodes(nodes);
    expect(roots.map((n) => n.id)).toEqual(['epic-1', 'epic-2']);
  });

  it('should return all nodes when none have parentId', () => {
    const nodes = [makeNode({ id: 'a' }), makeNode({ id: 'b' })];
    expect(getRootNodes(nodes)).toHaveLength(2);
  });

  it('should return empty array for empty input', () => {
    expect(getRootNodes([])).toEqual([]);
  });
});

describe('getVisibleNodes', () => {
  const nodes = [
    makeNode({ id: 'epic-1' }),
    makeNode({ id: 'task-1', parentId: 'epic-1' }),
    makeNode({ id: 'task-2', parentId: 'epic-1' }),
    makeNode({ id: 'sub-1', parentId: 'task-1' }),
    makeNode({ id: 'epic-2' }),
  ];

  it('should return only root nodes when nothing expanded', () => {
    const map = buildChildrenMap(nodes, []);
    const visible = getVisibleNodes(nodes, new Set(), map);
    expect(visible.map((n) => n.id)).toEqual(['epic-1', 'epic-2']);
  });

  it('should include direct children of expanded nodes', () => {
    const map = buildChildrenMap(nodes, []);
    const visible = getVisibleNodes(nodes, new Set(['epic-1']), map);
    expect(visible.map((n) => n.id)).toEqual(['epic-1', 'task-1', 'task-2', 'epic-2']);
  });

  it('should include nested children when multiple levels expanded', () => {
    const map = buildChildrenMap(nodes, []);
    const visible = getVisibleNodes(nodes, new Set(['epic-1', 'task-1']), map);
    // DFS order: task-1 expanded → sub-1 before task-2
    expect(visible.map((n) => n.id)).toEqual(['epic-1', 'task-1', 'sub-1', 'task-2', 'epic-2']);
  });

  it('should handle orphan nodes (parentId pointing to non-existent node)', () => {
    const orphanNodes = [
      makeNode({ id: 'a' }),
      makeNode({ id: 'b', parentId: 'non-existent' }),
    ];
    const map = buildChildrenMap(orphanNodes, []);
    // orphan should appear as root since parent doesn't exist
    const visible = getVisibleNodes(orphanNodes, new Set(), map);
    expect(visible.map((n) => n.id)).toEqual(['a', 'b']);
  });
});

describe('buildHierarchyTree', () => {
  it('should build nested tree structure', () => {
    const nodes = [
      makeNode({ id: 'epic-1' }),
      makeNode({ id: 'task-1', parentId: 'epic-1' }),
      makeNode({ id: 'sub-1', parentId: 'task-1' }),
    ];
    const map = buildChildrenMap(nodes, []);
    const tree = buildHierarchyTree(nodes, map);

    expect(tree).toHaveLength(1);
    expect(tree[0].node.id).toBe('epic-1');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].node.id).toBe('task-1');
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].node.id).toBe('sub-1');
  });

  it('should handle flat graph (all roots)', () => {
    const nodes = [makeNode({ id: 'a' }), makeNode({ id: 'b' })];
    const map = buildChildrenMap(nodes, []);
    const tree = buildHierarchyTree(nodes, map);
    expect(tree).toHaveLength(2);
    expect(tree[0].children).toHaveLength(0);
    expect(tree[1].children).toHaveLength(0);
  });

  it('should handle empty input', () => {
    expect(buildHierarchyTree([], new Map())).toEqual([]);
  });

  it('should handle orphan nodes as roots', () => {
    const nodes = [
      makeNode({ id: 'epic-1' }),
      makeNode({ id: 'orphan', parentId: 'deleted-parent' }),
    ];
    const map = buildChildrenMap(nodes, []);
    const tree = buildHierarchyTree(nodes, map);
    // orphan should appear at root level since its parent doesn't exist in nodes
    expect(tree.map((t) => t.node.id)).toContain('orphan');
  });
});

describe('hasExpandableChildren', () => {
  it('should return true if node has children', () => {
    const map = new Map([['epic-1', ['task-1', 'task-2']]]);
    expect(hasExpandableChildren('epic-1', map)).toBe(true);
  });

  it('should return false if node has no children', () => {
    const map = new Map([['epic-1', ['task-1']]]);
    expect(hasExpandableChildren('task-1', map)).toBe(false);
  });

  it('should return false for unknown node', () => {
    expect(hasExpandableChildren('unknown', new Map())).toBe(false);
  });
});

describe('getChildCount', () => {
  it('should return correct count', () => {
    const map = new Map([['epic-1', ['task-1', 'task-2', 'task-3']]]);
    expect(getChildCount('epic-1', map)).toBe(3);
  });

  it('should return 0 for node without children', () => {
    expect(getChildCount('leaf', new Map())).toBe(0);
  });
});
