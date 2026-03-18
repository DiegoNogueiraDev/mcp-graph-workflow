import { describe, it, expect } from "vitest";
import Graph from "graphology";
import { computeNHopNeighbors } from "../web/dashboard/src/lib/graph-bfs.js";

function makeGraph(type: "directed" | "undirected" = "directed"): Graph {
  return new Graph({ type });
}

describe("computeNHopNeighbors", () => {
  it("should return only anchor node for depth 0", () => {
    const g = makeGraph();
    g.addNode("A");
    g.addNode("B");
    g.addEdge("A", "B");

    const result = computeNHopNeighbors(g, "A", 0);
    expect(result).toEqual(new Set(["A"]));
  });

  it("should return direct neighbors for depth 1", () => {
    const g = makeGraph();
    g.addNode("A");
    g.addNode("B");
    g.addNode("C");
    g.addEdge("A", "B");
    g.addEdge("A", "C");

    const result = computeNHopNeighbors(g, "A", 1);
    expect(result).toEqual(new Set(["A", "B", "C"]));
  });

  it("should return 2-hop neighbors for depth 2", () => {
    const g = makeGraph();
    g.addNode("A");
    g.addNode("B");
    g.addNode("C");
    g.addNode("D");
    g.addEdge("A", "B");
    g.addEdge("B", "C");
    g.addEdge("C", "D");

    const result = computeNHopNeighbors(g, "A", 2);
    expect(result).toEqual(new Set(["A", "B", "C"]));
    expect(result.has("D")).toBe(false);
  });

  it("should handle linear chain A→B→C→D correctly", () => {
    const g = makeGraph();
    g.addNode("A");
    g.addNode("B");
    g.addNode("C");
    g.addNode("D");
    g.addEdge("A", "B");
    g.addEdge("B", "C");
    g.addEdge("C", "D");

    expect(computeNHopNeighbors(g, "A", 0)).toEqual(new Set(["A"]));
    expect(computeNHopNeighbors(g, "A", 1)).toEqual(new Set(["A", "B"]));
    expect(computeNHopNeighbors(g, "A", 2)).toEqual(new Set(["A", "B", "C"]));
    expect(computeNHopNeighbors(g, "A", 3)).toEqual(new Set(["A", "B", "C", "D"]));
    expect(computeNHopNeighbors(g, "A", 10)).toEqual(new Set(["A", "B", "C", "D"]));
  });

  it("should handle cycles without infinite loop", () => {
    const g = makeGraph();
    g.addNode("A");
    g.addNode("B");
    g.addNode("C");
    g.addEdge("A", "B");
    g.addEdge("B", "C");
    g.addEdge("C", "A");

    const result = computeNHopNeighbors(g, "A", 2);
    expect(result).toEqual(new Set(["A", "B", "C"]));
  });

  it("should return empty set if anchor not in graph", () => {
    const g = makeGraph();
    g.addNode("A");

    const result = computeNHopNeighbors(g, "Z", 5);
    expect(result).toEqual(new Set<string>());
  });

  it("should work with undirected edges (graphology neighbors)", () => {
    const g = makeGraph("undirected");
    g.addNode("A");
    g.addNode("B");
    g.addNode("C");
    g.addUndirectedEdge("A", "B");
    g.addUndirectedEdge("B", "C");

    const result = computeNHopNeighbors(g, "C", 1);
    expect(result).toEqual(new Set(["C", "B"]));

    const result2 = computeNHopNeighbors(g, "C", 2);
    expect(result2).toEqual(new Set(["A", "B", "C"]));
  });
});
