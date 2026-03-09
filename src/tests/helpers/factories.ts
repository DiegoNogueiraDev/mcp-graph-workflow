/**
 * Shared test factories for creating minimal valid graph objects.
 * Eliminates duplication across 18+ test files.
 */
import type { GraphNode, GraphEdge } from "../../core/graph/graph-types.js";
import { generateId } from "../../core/utils/id.js";
import { now } from "../../core/utils/time.js";

export function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  const timestamp = now();
  return {
    id: generateId("node"),
    type: "task",
    title: "Test task",
    status: "backlog",
    priority: 3,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

export function makeEdge(from: string, to: string, overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: generateId("edge"),
    from,
    to,
    relationType: "depends_on",
    createdAt: now(),
    ...overrides,
  };
}

export function makeEpic(overrides: Partial<GraphNode> = {}): GraphNode {
  return makeNode({ type: "epic", title: "Test epic", priority: 2, ...overrides });
}

export function makeTask(overrides: Partial<GraphNode> = {}): GraphNode {
  return makeNode({ type: "task", title: "Test task", priority: 3, ...overrides });
}

export function makeSubtask(overrides: Partial<GraphNode> = {}): GraphNode {
  return makeNode({ type: "subtask", title: "Test subtask", priority: 3, ...overrides });
}

export function makeDoneTask(overrides: Partial<GraphNode> = {}): GraphNode {
  return makeNode({ type: "task", title: "Done task", status: "done", ...overrides });
}

export function makeBlockedTask(overrides: Partial<GraphNode> = {}): GraphNode {
  return makeNode({ type: "task", title: "Blocked task", blocked: true, ...overrides });
}
