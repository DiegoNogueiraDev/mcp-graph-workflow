import { describe, it, expect } from "vitest";
import { convertToGraph } from "../core/importer/prd-to-graph.js";
import type { ExtractionResult } from "../core/parser/extract.js";
import type { ClassifiedBlock, ClassifiedItem } from "../core/parser/classify.js";

// ── Helper ───────────────────────────────────────────

function makeBlock(overrides: Partial<ClassifiedBlock> = {}): ClassifiedBlock {
  return {
    type: "task",
    title: "Default block",
    description: "",
    items: [],
    startLine: 1,
    endLine: 10,
    confidence: 0.9,
    ...overrides,
  };
}

function makeItem(overrides: Partial<ClassifiedItem> = {}): ClassifiedItem {
  return {
    type: "task",
    text: "Default item",
    line: 5,
    confidence: 0.9,
    ...overrides,
  };
}

function makeExtraction(blocks: ClassifiedBlock[]): ExtractionResult {
  const allItems = blocks.flatMap((b) => b.items);
  const countType = (type: string): number =>
    blocks.filter((b) => b.type === type).length +
    allItems.filter((i) => i.type === type).length;

  return {
    blocks,
    summary: {
      totalSections: blocks.length,
      epics: countType("epic"),
      tasks: countType("task"),
      subtasks: countType("subtask"),
      requirements: countType("requirement"),
      constraints: countType("constraint"),
      acceptanceCriteria: countType("acceptance_criteria"),
      risks: countType("risk"),
      unknown: countType("unknown"),
    },
  };
}

// ── Tests ────────────────────────────────────────────

describe("convertToGraph", () => {
  it("cria nodes com tipos corretos a partir de blocks classificados", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({ type: "epic", title: "My Epic" }),
      makeBlock({ type: "task", title: "My Task" }),
      makeBlock({ type: "requirement", title: "My Req" }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes[0].type).toBe("epic");
    expect(result.nodes[1].type).toBe("task");
    expect(result.nodes[2].type).toBe("requirement");
  });

  it("atribui prioridades padrao por tipo", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({ type: "epic", title: "E" }),
      makeBlock({ type: "task", title: "T" }),
      makeBlock({ type: "subtask", title: "S" }),
      makeBlock({ type: "constraint", title: "C" }),
      makeBlock({ type: "requirement", title: "R" }),
      makeBlock({ type: "risk", title: "Ri" }),
      makeBlock({ type: "acceptance_criteria", title: "AC" }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const byTitle = (t: string) => result.nodes.find((n) => n.title === t)!;
    expect(byTitle("E").priority).toBe(2);
    expect(byTitle("T").priority).toBe(3);
    expect(byTitle("S").priority).toBe(3);
    expect(byTitle("C").priority).toBe(1);
    expect(byTitle("R").priority).toBe(2);
    expect(byTitle("Ri").priority).toBe(2);
    expect(byTitle("AC").priority).toBe(4);
  });

  it("cria edges parent_of para items filhos de blocks", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({
        type: "epic",
        title: "Parent Epic",
        items: [
          makeItem({ type: "task", text: "Child Task 1" }),
          makeItem({ type: "task", text: "Child Task 2" }),
        ],
      }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const parentNode = result.nodes.find((n) => n.title === "Parent Epic")!;
    const parentOfEdges = result.edges.filter((e) => e.relationType === "parent_of");
    expect(parentOfEdges).toHaveLength(2);
    for (const edge of parentOfEdges) {
      expect(edge.from).toBe(parentNode.id);
    }
    // Children should have parentId set
    const children = result.nodes.filter((n) => n.parentId === parentNode.id);
    expect(children).toHaveLength(2);
  });

  it("infere dependencias sequenciais entre tasks irmas", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({
        type: "epic",
        title: "Epic",
        items: [
          makeItem({ type: "task", text: "Task A", line: 1 }),
          makeItem({ type: "task", text: "Task B", line: 2 }),
          makeItem({ type: "task", text: "Task C", line: 3 }),
        ],
      }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const dependsOnEdges = result.edges.filter((e) => e.relationType === "depends_on");
    expect(dependsOnEdges).toHaveLength(2);
    for (const edge of dependsOnEdges) {
      expect(edge.metadata?.inferred).toBe(true);
      expect(edge.metadata?.confidence).toBe(0.6);
    }
    // Task B depends on Task A, Task C depends on Task B
    const taskA = result.nodes.find((n) => n.title === "Task A")!;
    const taskB = result.nodes.find((n) => n.title === "Task B")!;
    const taskC = result.nodes.find((n) => n.title === "Task C")!;
    expect(dependsOnEdges.some((e) => e.from === taskB.id && e.to === taskA.id)).toBe(true);
    expect(dependsOnEdges.some((e) => e.from === taskC.id && e.to === taskB.id)).toBe(true);
  });

  it("infere dependencias por palavras-chave na descricao", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({
        type: "task",
        title: "Setup Database",
        description: "Configure the database",
      }),
      makeBlock({
        type: "task",
        title: "Build API",
        description: "This depends on Setup Database before starting",
      }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const keywordEdges = result.edges.filter(
      (e) => e.relationType === "depends_on" && e.reason === "Keyword inference from description",
    );
    expect(keywordEdges).toHaveLength(1);
    const buildApi = result.nodes.find((n) => n.title === "Build API")!;
    const setupDb = result.nodes.find((n) => n.title === "Setup Database")!;
    expect(keywordEdges[0].from).toBe(buildApi.id);
    expect(keywordEdges[0].to).toBe(setupDb.id);
  });

  it("linka constraints a tasks via related_to", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({ type: "constraint", title: "No external deps" }),
      makeBlock({ type: "task", title: "Task 1" }),
      makeBlock({ type: "task", title: "Task 2" }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const relatedEdges = result.edges.filter((e) => e.relationType === "related_to");
    expect(relatedEdges).toHaveLength(2);
    const constraintNode = result.nodes.find((n) => n.type === "constraint")!;
    for (const edge of relatedEdges) {
      expect(edge.from).toBe(constraintNode.id);
      expect(edge.metadata?.confidence).toBe(0.4);
      expect(edge.metadata?.inferred).toBe(true);
    }
  });

  it("linka acceptance_criteria sem parentId a epics via implements", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({ type: "epic", title: "My Epic" }),
      makeBlock({ type: "acceptance_criteria", title: "AC 1" }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const implementsEdges = result.edges.filter((e) => e.relationType === "implements");
    expect(implementsEdges).toHaveLength(1);
    const acNode = result.nodes.find((n) => n.type === "acceptance_criteria")!;
    const epicNode = result.nodes.find((n) => n.type === "epic")!;
    expect(implementsEdges[0].from).toBe(acNode.id);
    expect(implementsEdges[0].to).toBe(epicNode.id);
    expect(implementsEdges[0].metadata?.confidence).toBe(0.6);
  });

  it("preenche sourceRef com file, startLine, endLine, confidence", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({ type: "task", title: "T", startLine: 5, endLine: 15, confidence: 0.85 }),
    ]);

    // Act
    const result = convertToGraph(extraction, "my-prd.md");

    // Assert
    const node = result.nodes[0];
    expect(node.sourceRef).toEqual({
      file: "my-prd.md",
      startLine: 5,
      endLine: 15,
      confidence: 0.85,
    });
  });

  it("marca metadata.inferred=true para confidence < 0.7", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({ type: "task", title: "Low conf", confidence: 0.5 }),
      makeBlock({ type: "task", title: "High conf", confidence: 0.9 }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const lowConf = result.nodes.find((n) => n.title === "Low conf")!;
    const highConf = result.nodes.find((n) => n.title === "High conf")!;
    expect(lowConf.metadata?.inferred).toBe(true);
    expect(highConf.metadata?.inferred).toBe(false);
    // Both should have origin=imported
    expect(lowConf.metadata?.origin).toBe("imported");
    expect(highConf.metadata?.origin).toBe("imported");
  });

  it("retorna stats corretas", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({
        type: "epic",
        title: "Epic",
        items: [
          makeItem({ type: "task", text: "Task A" }),
          makeItem({ type: "task", text: "Task B" }),
        ],
      }),
      makeBlock({ type: "constraint", title: "Constraint" }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    // Nodes: 1 epic + 2 child tasks + 1 constraint = 4
    expect(result.stats.nodesCreated).toBe(4);
    // Edges: 2 parent_of + 1 sequential depends_on + 2 constraint related_to = 5
    expect(result.stats.edgesCreated).toBe(5);
    // Blocked: Task B depends on Task A = 1 blocked
    expect(result.stats.blockedTasks).toBe(1);
    // Inferred: 1 sequential + 2 constraint = 3
    expect(result.stats.inferredDeps).toBe(3);
  });

  it("retorna vazio para ExtractionResult sem blocks", () => {
    // Arrange
    const extraction = makeExtraction([]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.stats.nodesCreated).toBe(0);
    expect(result.stats.edgesCreated).toBe(0);
    expect(result.stats.blockedTasks).toBe(0);
    expect(result.stats.inferredDeps).toBe(0);
  });

  it("ignora blocks com tipo invalido", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({ type: "unknown" as ClassifiedBlock["type"], title: "Unknown block" }),
      makeBlock({ type: "task", title: "Valid task" }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].title).toBe("Valid task");
  });
});
