import type Graph from "graphology";

/**
 * BFS traversal to find all nodes within `maxDepth` hops from `anchor`.
 * Returns an empty set if the anchor node is not present in the graph.
 */
export function computeNHopNeighbors(graph: Graph, anchor: string, maxDepth: number): Set<string> {
  if (!graph.hasNode(anchor)) {
    return new Set<string>();
  }

  const visited = new Set<string>([anchor]);
  const queue: Array<[string, number]> = [[anchor, 0]];

  while (queue.length > 0) {
    const [node, depth] = queue.shift()!;
    if (depth >= maxDepth) continue;
    for (const neighbor of graph.neighbors(node)) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, depth + 1]);
      }
    }
  }

  return visited;
}
