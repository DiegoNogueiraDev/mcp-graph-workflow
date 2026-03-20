/**
 * Converts parser extraction results into graph nodes and edges.
 */

import type { GraphNode, GraphEdge, NodeType, NodeStatus, XpSize } from "../graph/graph-types.js";
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

const SIZE_PATTERN = /\*\*(?:Size|Tamanho)\s*:\s*\*\*\s*(XS|S|M|L|XL)\b/i;

function extractXpSize(description: string | undefined): XpSize | undefined {
  if (!description) return undefined;
  const match = description.match(SIZE_PATTERN);
  if (!match) return undefined;
  return match[1].toUpperCase() as XpSize;
}

const PRIORITY_PATTERN = /\*\*(?:Priority|Prioridade)\s*:\s*\*\*\s*(high|medium|low|alta|m[eé]dia|baixa|[1-5])\b/i;

function extractPriority(description: string | undefined): 1 | 2 | 3 | 4 | 5 | undefined {
  if (!description) return undefined;
  const match = description.match(PRIORITY_PATTERN);
  if (!match) return undefined;
  const val = match[1].toLowerCase();
  if (val === "high" || val === "alta" || val === "1") return 1;
  if (val === "2") return 2;
  if (val === "medium" || val === "média" || val === "media" || val === "3") return 3;
  if (val === "4") return 4;
  if (val === "low" || val === "baixa" || val === "5") return 5;
  return undefined;
}

const TAGS_PATTERN = /\*\*(?:Tags?)\s*:\s*\*\*\s*(.+)/i;

function extractTags(description: string | undefined): string[] | undefined {
  if (!description) return undefined;
  const match = description.match(TAGS_PATTERN);
  if (!match) return undefined;
  const tags = match[1].split(/,/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

function createNodeFromBlock(
  block: ClassifiedBlock,
  sourceFile: string,
  parentId: string | null = null,
): GraphNode | null {
  const nodeType = mapBlockTypeToNodeType(block.type);
  if (!nodeType) return null;

  const timestamp = now();
  const xpSize = extractXpSize(block.description);
  const node: GraphNode = {
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
  if (xpSize) {
    node.xpSize = xpSize;
  }
  const extractedPriority = extractPriority(block.description);
  if (extractedPriority) {
    node.priority = extractedPriority;
  }
  const extractedTags = extractTags(block.description);
  if (extractedTags) {
    node.tags = extractedTags;
  }
  return node;
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

function findNodeByRef(nodes: GraphNode[], ref: string, excludeId: string): GraphNode | undefined {
  const refLower = ref.toLowerCase().trim();
  if (!refLower || refLower === "none" || refLower === "n/a" || refLower === "nenhum") return undefined;

  // Strategy 1: Exact title match
  const exact = nodes.find((n) => n.id !== excludeId && n.title.toLowerCase().trim() === refLower);
  if (exact) return exact;

  // Strategy 2: Task number pattern — "Task 1.1" matches "Task 1.1: Description"
  const taskNumMatch = refLower.match(/^task\s+([\d.]+)/i);
  if (taskNumMatch) {
    const taskNum = taskNumMatch[1];
    const byNum = nodes.find((n) => {
      if (n.id === excludeId) return false;
      const m = n.title.match(/^task\s+([\d.]+)/i);
      return m ? m[1] === taskNum : false;
    });
    if (byNum) return byNum;
  }

  // Strategy 3: Title starts with reference
  const startsWith = nodes.find((n) =>
    n.id !== excludeId && n.title.toLowerCase().trim().startsWith(refLower),
  );
  if (startsWith) return startsWith;

  return undefined;
}

export function convertToGraph(
  extraction: ExtractionResult,
  sourceFile: string,
): ConversionResult {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Pass 1: Create nodes from top-level blocks (maps block index → node)
  const blockNodeMap: Map<number, GraphNode> = new Map();
  for (let bi = 0; bi < extraction.blocks.length; bi++) {
    const block = extraction.blocks[bi];
    const node = createNodeFromBlock(block, sourceFile);
    if (!node) continue;
    nodes.push(node);
    blockNodeMap.set(bi, node);

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

      // Parent-child edges (bidirectional)
      edges.push(createEdge(node.id, childNode.id, "parent_of", undefined, false, 1));
      edges.push(createEdge(childNode.id, node.id, "child_of", undefined, false, 1));

      if (itemType === "task" || itemType === "subtask") {
        childTaskNodes.push(childNode);
      }
    }

    // Infer sequential dependencies among sibling tasks
    if (childTaskNodes.length > 1) {
      edges.push(...inferSequentialDeps(childTaskNodes));
    }
  }

  // Pass 1.5: Heading hierarchy — assign parent based on heading level
  // Use a stack to track the current parent at each heading depth
  const levelStack: { level: number; node: GraphNode }[] = [];

  for (let bi = 0; bi < extraction.blocks.length; bi++) {
    const block = extraction.blocks[bi];
    const node = blockNodeMap.get(bi);
    if (!node) continue;

    // Pop stack while top has level >= current (siblings or deeper = not parent)
    while (levelStack.length > 0 && levelStack[levelStack.length - 1].level >= block.level) {
      levelStack.pop();
    }

    // If stack not empty, the top is the parent
    if (levelStack.length > 0) {
      const parent = levelStack[levelStack.length - 1].node;
      node.parentId = parent.id;
      edges.push(createEdge(parent.id, node.id, "parent_of", "Heading hierarchy", false, 1));
      edges.push(createEdge(node.id, parent.id, "child_of", "Heading hierarchy", false, 1));
    }

    levelStack.push({ level: block.level, node });
  }

  // Pass 3: Link constraints to tasks as blockers (scoped to same parent)
  const constraintNodes = nodes.filter((n) => n.type === "constraint");
  const taskNodes = nodes.filter((n) => n.type === "task" || n.type === "subtask");

  for (const constraint of constraintNodes) {
    const scopedTasks = constraint.parentId
      ? taskNodes.filter((t) => t.parentId === constraint.parentId)
      : taskNodes;

    for (const task of scopedTasks) {
      edges.push(
        createEdge(constraint.id, task.id, "related_to", "Constraint applies to task", true, 0.4),
      );
    }
  }

  // Pass 4: Link acceptance criteria to nearest previous epic/task
  const acNodes = nodes.filter((n) => n.type === "acceptance_criteria");
  for (const ac of acNodes) {
    if (ac.parentId) continue; // already linked via heading hierarchy

    // Find the nearest previous epic or task in block order
    const acBlockIndex = [...blockNodeMap.entries()].find(([, n]) => n.id === ac.id)?.[0];
    if (acBlockIndex !== undefined) {
      let nearestParent: GraphNode | null = null;
      for (let i = acBlockIndex - 1; i >= 0; i--) {
        const candidate = blockNodeMap.get(i);
        if (candidate && (candidate.type === "epic" || candidate.type === "task")) {
          nearestParent = candidate;
          break;
        }
      }
      if (nearestParent) {
        edges.push(createEdge(ac.id, nearestParent.id, "implements", "Acceptance criteria for epic", true, 0.6));
      }
    }
  }

  // Pass 4.5: Parse explicit **Depends on:** / **Depende de:** references
  const DEPENDS_PATTERN = /\*\*(?:Depends?\s+on|Depende\s+de)\s*:\s*\*\*\s*(.+)/i;
  for (const node of nodes) {
    if (!node.description) continue;
    const match = node.description.match(DEPENDS_PATTERN);
    if (!match) continue;

    const depRefs = match[1].split(/,\s*| e | and /).map((s) => s.trim()).filter(Boolean);
    for (const ref of depRefs) {
      const target = findNodeByRef(nodes, ref, node.id);
      if (target) {
        edges.push(
          createEdge(node.id, target.id, "depends_on", `Explicit depends_on: "${ref}"`, false, 0.85),
        );
      }
    }
  }

  // Pass 5: Keyword-based dependency inference across all task nodes
  const allTaskNodes = nodes.filter((n) => n.type === "task");
  edges.push(...inferKeywordDeps(allTaskNodes));

  // Count blocked tasks (tasks that have incoming depends_on edges to non-done nodes)
  const dependentNodeIds = new Set(
    edges.filter((e) => e.relationType === "depends_on").map((e) => e.from),
  );
  const blockedTasks = dependentNodeIds.size;

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
