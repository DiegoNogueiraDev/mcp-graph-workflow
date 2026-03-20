import { describe, it, expect } from "vitest";
import { graphToMermaid } from "../core/graph/mermaid-export.js";
import { makeNode, makeEdge } from "./helpers/factories.js";

describe("graphToMermaid", () => {
  it("should return valid minimal mermaid for empty graph", () => {
    const result = graphToMermaid([], []);
    expect(result).toBe("graph TD\n");
  });

  it("should render a single node with title", () => {
    const node = makeNode({ id: "n1", title: "Setup DB" });
    const result = graphToMermaid([node], []);
    expect(result).toContain("graph TD");
    expect(result).toContain('n1["Setup DB"]');
  });

  it("should render parent_of edge with label", () => {
    const parent = makeNode({ id: "n1", title: "Epic" });
    const child = makeNode({ id: "n2", title: "Task" });
    const edge = makeEdge("n1", "n2", { relationType: "parent_of" });

    const result = graphToMermaid([parent, child], [edge]);
    expect(result).toContain("n1 -->|parent_of| n2");
  });

  it("should render depends_on edge with dashed line", () => {
    const a = makeNode({ id: "n1", title: "A" });
    const b = makeNode({ id: "n2", title: "B" });
    const edge = makeEdge("n1", "n2", { relationType: "depends_on" });

    const result = graphToMermaid([a, b], [edge]);
    expect(result).toContain("n1 -.->|depends_on| n2");
  });

  it("should render blocks edge with dashed line", () => {
    const a = makeNode({ id: "n1", title: "A" });
    const b = makeNode({ id: "n2", title: "B" });
    const edge = makeEdge("n1", "n2", { relationType: "blocks" });

    const result = graphToMermaid([a, b], [edge]);
    expect(result).toContain("n1 -.->|blocks| n2");
  });

  it("should apply status colors via style classes", () => {
    const done = makeNode({ id: "n1", title: "Done", status: "done" });
    const inProgress = makeNode({ id: "n2", title: "WIP", status: "in_progress" });
    const blocked = makeNode({ id: "n3", title: "Blocked", status: "blocked" });
    const backlog = makeNode({ id: "n4", title: "Backlog", status: "backlog" });

    const result = graphToMermaid([done, inProgress, blocked, backlog], []);
    expect(result).toContain("style n1 fill:#4caf50");
    expect(result).toContain("style n2 fill:#2196f3");
    expect(result).toContain("style n3 fill:#f44336");
    expect(result).toContain("style n4 fill:#9e9e9e");
  });

  it("should filter nodes by status", () => {
    const done = makeNode({ id: "n1", title: "Done", status: "done" });
    const backlog = makeNode({ id: "n2", title: "Backlog", status: "backlog" });

    const result = graphToMermaid([done, backlog], [], { filterStatus: ["done"] });
    expect(result).toContain("n1");
    expect(result).not.toContain("n2");
  });

  it("should filter nodes by type", () => {
    const epic = makeNode({ id: "n1", title: "Epic", type: "epic" });
    const task = makeNode({ id: "n2", title: "Task", type: "task" });

    const result = graphToMermaid([epic, task], [], { filterType: ["epic"] });
    expect(result).toContain("n1");
    expect(result).not.toContain("n2");
  });

  it("should escape special characters in title", () => {
    const node = makeNode({ id: "n1", title: 'Task with "quotes" & <brackets>' });
    const result = graphToMermaid([node], []);
    expect(result).toContain('n1["Task with &quot;quotes&quot; &amp; &lt;brackets&gt;"]');
  });

  it("should render mindmap format", () => {
    const root = makeNode({ id: "n1", title: "Root", type: "epic" });
    const child = makeNode({ id: "n2", title: "Child", type: "task", parentId: "n1" });

    const result = graphToMermaid([root, child], [], { format: "mindmap" });
    expect(result).toContain("mindmap");
    expect(result).toContain("Root");
    expect(result).toContain("Child");
  });

  it("should respect direction option", () => {
    const result = graphToMermaid([], [], { direction: "LR" });
    expect(result).toBe("graph LR\n");
  });

  it("should exclude edges referencing filtered-out nodes", () => {
    const done = makeNode({ id: "n1", title: "Done", status: "done" });
    const backlog = makeNode({ id: "n2", title: "Backlog", status: "backlog" });
    const edge = makeEdge("n1", "n2", { relationType: "parent_of" });

    const result = graphToMermaid([done, backlog], [edge], { filterStatus: ["done"] });
    expect(result).not.toContain("n2");
    expect(result).not.toContain("parent_of");
  });

  it("should handle ready status with distinct color", () => {
    const ready = makeNode({ id: "n1", title: "Ready", status: "ready" });
    const result = graphToMermaid([ready], []);
    expect(result).toContain("style n1 fill:#ff9800");
  });
});
