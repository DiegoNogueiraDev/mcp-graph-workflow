/**
 * Converts parser extraction results into graph nodes and edges.
 */

import type { GraphNode, GraphEdge, NodeType, NodeStatus } from "../graph/graph-types.js";
import type { ExtractionResult } from "../parser/extract.js";
import type { ClassifiedBlock } from "../parser/classify.js";
import { generateId } from "../utils/id.js";
import { now } from "../utils/time.js";
import { logger } from "../utils/logger.js";

interface ConversionResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    nodesCreated: number;
    edgesCreated: number;
    blockedTasks: number;
    inferredDeps: number;
  };
}

function mapBlockTypeToNodeType(blockType: string): NodeType | null {
  const valid: NodeType[] = [
    "epic", "task", "subtask", "requirement", "constraint",
    "milestone", "acceptance_criteria", "risk", "decision",
  ];
  if (valid.includes(blockType as NodeType)) return blockType as NodeType;
  return null;
}

function defaultPriorityForType(type: NodeType): 1 | 2 | 3 | 4 | 5 {
  switch (type) {
    case "epic": return 2;
    case "requirement": return 2;
    case "constraint": return 1;
    case "task": return 3;
    case "subtask": return 3;
    case "risk": return 2;
    case "acceptance_criteria": return 4;
    default: return 3;
  }
}

function createNodeFromBlock(
  block: ClassifiedBlock,
  sourceFile: string,
  parentId: string | null = null,
): GraphNode | null {
  const nodeType = mapBlockTypeToNodeType(block.type);
  if (!nodeType) return null;

  const timestamp = now();
  return {
    id: generateId("node"),
    type: nodeType,
    title: block.title,
    description: block.description || undefined,
    status: "backlog" as NodeStatus,
    priority: defaultPriorityForType(nodeType),
    parentId,
    sourceRef: {
      file: sourceFile,
      startLine: block.startLine,
      endLine: block.endLine,
      confidence: block.confidence,
    },
    metadata: {
      inferred: block.confidence < 0.7,
      origin: "imported",
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function createEdge(
  from: string,
  to: string,
  relationType: GraphEdge["relationType"],
  reason?: string,
  inferred: boolean = false,
  confidence: number = 1,
): GraphEdge {
  return {
    id: generateId("edge"),
    from,
    to,
    relationType,
    reason,
    metadata: { inferred, confidence },
    createdAt: now(),
  };
}

/**
 * Detect simple sequential dependencies between tasks.
 * If tasks appear in a numbered list, each depends on the previous.
 */
function inferSequentialDeps(taskNodes: GraphNode[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (let i = 1; i < taskNodes.length; i++) {
    edges.push(
      createEdge(
        taskNodes[i].id,
        taskNodes[i - 1].id,
        "depends_on",
        `Sequential order: "${taskNodes[i].title}" after "${taskNodes[i - 1].title}"`,
        true,
        0.6,
      ),
    );
  }
  return edges;
}

/**
 * Detect keyword-based dependencies in descriptions.
 */
function inferKeywordDeps(nodes: GraphNode[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const depKeywords = [
    /antes de/i, /após/i, /depois de/i, /depende de/i,
    /somente depois/i, /before/i, /after/i, /depends on/i,
  ];

  for (const node of nodes) {
    if (!node.description) continue;
    for (const other of nodes) {
      if (node.id === other.id) continue;
      // Check if node's description references other's title
      const titleLower = other.title.toLowerCase();
      const descLower = node.description.toLowerCase();

      if (descLower.includes(titleLower) && depKeywords.some((p) => p.test(descLower))) {
        edges.push(
          createEdge(node.id, other.id, "depends_on", `Keyword inference from description`, true, 0.5),
        );
      }
    }
  }
  return edges;
}

export function convertToGraph(
  extraction: ExtractionResult,
  sourceFile: string,
): ConversionResult {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let blockedTasks = 0;

  // Pass 1: Create nodes from top-level blocks
  for (const block of extraction.blocks) {
    const node = createNodeFromBlock(block, sourceFile);
    if (!node) continue;
    nodes.push(node);

    // Pass 2: Create child nodes from block items
    const childTaskNodes: GraphNode[] = [];
    for (const item of block.items) {
      const itemType = mapBlockTypeToNodeType(item.type);
      if (!itemType) continue;

      const timestamp = now();
      const childNode: GraphNode = {
        id: generateId("node"),
        type: itemType,
        title: item.text,
        status: "backlog",
        priority: defaultPriorityForType(itemType),
        parentId: node.id,
        sourceRef: {
          file: sourceFile,
          startLine: item.line,
          endLine: item.line,
          confidence: item.confidence,
        },
        metadata: {
          inferred: item.confidence < 0.7,
          origin: "imported",
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      nodes.push(childNode);

      // Parent-child edge
      edges.push(createEdge(node.id, childNode.id, "parent_of", undefined, false, 1));

      if (itemType === "task" || itemType === "subtask") {
        childTaskNodes.push(childNode);
      }
    }

    // Infer sequential dependencies among sibling tasks
    if (childTaskNodes.length > 1) {
      edges.push(...inferSequentialDeps(childTaskNodes));
    }
  }

  // Pass 3: Link constraints to tasks as blockers
  const constraintNodes = nodes.filter((n) => n.type === "constraint");
  const taskNodes = nodes.filter((n) => n.type === "task" || n.type === "subtask");

  for (const constraint of constraintNodes) {
    for (const task of taskNodes) {
      // Only create block edges if constraint text seems related
      // For now, constraints block all tasks (simple heuristic for MVP)
      edges.push(
        createEdge(constraint.id, task.id, "related_to", "Constraint applies to task", true, 0.4),
      );
    }
  }

  // Pass 4: Link acceptance criteria to epic/parent
  const acNodes = nodes.filter((n) => n.type === "acceptance_criteria");
  const epicNodes = nodes.filter((n) => n.type === "epic");
  for (const ac of acNodes) {
    if (ac.parentId) continue; // already linked
    for (const epic of epicNodes) {
      edges.push(createEdge(ac.id, epic.id, "implements", "Acceptance criteria for epic", true, 0.6));
    }
  }

  // Pass 5: Keyword-based dependency inference across all task nodes
  const allTaskNodes = nodes.filter((n) => n.type === "task");
  edges.push(...inferKeywordDeps(allTaskNodes));

  // Count blocked tasks (tasks that have incoming depends_on edges to non-done nodes)
  const dependentNodeIds = new Set(
    edges.filter((e) => e.relationType === "depends_on").map((e) => e.from),
  );
  blockedTasks = dependentNodeIds.size;

  const inferredDeps = edges.filter((e) => e.metadata?.inferred).length;

  logger.debug("Graph conversion complete", {
    nodesCreated: nodes.length,
    edgesCreated: edges.length,
    blockedTasks,
    inferredDeps,
  });

  return {
    nodes,
    edges,
    stats: {
      nodesCreated: nodes.length,
      edgesCreated: edges.length,
      blockedTasks,
      inferredDeps,
    },
  };
}
