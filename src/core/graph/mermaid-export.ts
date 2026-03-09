import type { GraphNode, GraphEdge, NodeStatus, NodeType } from "./graph-types.js";

export interface MermaidExportOptions {
  format?: "flowchart" | "mindmap";
  filterStatus?: NodeStatus[];
  filterType?: NodeType[];
  direction?: "TD" | "LR";
}

const STATUS_COLORS: Record<NodeStatus, string> = {
  done: "#4caf50",
  in_progress: "#2196f3",
  blocked: "#f44336",
  backlog: "#9e9e9e",
  ready: "#ff9800",
};

const DASHED_RELATIONS = new Set(["depends_on", "blocks", "related_to"]);

function escapeMermaid(text: string): string {
  return text
    .replace(/&/g, "#amp;")
    .replace(/"/g, "#quot;")
    .replace(/</g, "#lt;")
    .replace(/>/g, "#gt;");
}

function filterNodes(
  nodes: GraphNode[],
  options?: MermaidExportOptions,
): GraphNode[] {
  let filtered = nodes;
  if (options?.filterStatus && options.filterStatus.length > 0) {
    const statuses = new Set(options.filterStatus);
    filtered = filtered.filter((n) => statuses.has(n.status));
  }
  if (options?.filterType && options.filterType.length > 0) {
    const types = new Set(options.filterType);
    filtered = filtered.filter((n) => types.has(n.type));
  }
  return filtered;
}

function buildMindmap(nodes: GraphNode[]): string {
  const lines: string[] = ["mindmap"];

  const childrenMap = new Map<string | undefined, GraphNode[]>();
  for (const node of nodes) {
    const parentKey = node.parentId ?? undefined;
    const children = childrenMap.get(parentKey) ?? [];
    children.push(node);
    childrenMap.set(parentKey, children);
  }

  function renderNode(node: GraphNode, depth: number): void {
    const indent = "  ".repeat(depth);
    lines.push(`${indent}${escapeMermaid(node.title)}`);
    const children = childrenMap.get(node.id) ?? [];
    for (const child of children) {
      renderNode(child, depth + 1);
    }
  }

  const roots = childrenMap.get(undefined) ?? [];
  for (const root of roots) {
    renderNode(root, 1);
  }

  return lines.join("\n") + "\n";
}

export function graphToMermaid(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options?: MermaidExportOptions,
): string {
  const filteredNodes = filterNodes(nodes, options);

  if (options?.format === "mindmap") {
    return buildMindmap(filteredNodes);
  }

  const direction = options?.direction ?? "TD";
  const lines: string[] = [`graph ${direction}`];

  if (filteredNodes.length === 0) {
    return lines.join("\n") + "\n";
  }

  const nodeIds = new Set(filteredNodes.map((n) => n.id));

  for (const node of filteredNodes) {
    lines.push(`  ${node.id}["${escapeMermaid(node.title)}"]`);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      continue;
    }
    const arrow = DASHED_RELATIONS.has(edge.relationType) ? "-.->" : "-->";
    lines.push(`  ${edge.from} ${arrow}|${edge.relationType}| ${edge.to}`);
  }

  for (const node of filteredNodes) {
    const color = STATUS_COLORS[node.status];
    if (color) {
      lines.push(`  style ${node.id} fill:${color}`);
    }
  }

  return lines.join("\n") + "\n";
}
