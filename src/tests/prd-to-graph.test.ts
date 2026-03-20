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
    level: 2,
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
    // Edges: 2 parent_of + 2 child_of + 1 sequential depends_on + 2 constraint related_to = 7
    expect(result.stats.edgesCreated).toBe(7);
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

  // ── Issue #1: Heading hierarchy (h3 under h2) ──────────

  it("h3 task sob h2 epic recebe parentId do epic + edges bidirecionais", () => {
    // Arrange — simula h2 Epic seguido de h3 Task
    const extraction = makeExtraction([
      makeBlock({ type: "epic", title: "Epic A", level: 2 }),
      makeBlock({ type: "task", title: "Task A.1", level: 3 }),
      makeBlock({ type: "task", title: "Task A.2", level: 3 }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const epic = result.nodes.find((n) => n.title === "Epic A")!;
    const task1 = result.nodes.find((n) => n.title === "Task A.1")!;
    const task2 = result.nodes.find((n) => n.title === "Task A.2")!;

    expect(task1.parentId).toBe(epic.id);
    expect(task2.parentId).toBe(epic.id);

    // Bidirectional edges
    expect(result.edges.some((e) => e.from === epic.id && e.to === task1.id && e.relationType === "parent_of")).toBe(true);
    expect(result.edges.some((e) => e.from === task1.id && e.to === epic.id && e.relationType === "child_of")).toBe(true);
    expect(result.edges.some((e) => e.from === epic.id && e.to === task2.id && e.relationType === "parent_of")).toBe(true);
    expect(result.edges.some((e) => e.from === task2.id && e.to === epic.id && e.relationType === "child_of")).toBe(true);
  });

  it("h4 subtask sob h3 task recebe parentId do task", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({ type: "epic", title: "Epic", level: 2 }),
      makeBlock({ type: "task", title: "Task", level: 3 }),
      makeBlock({ type: "subtask", title: "Subtask", level: 4 }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const task = result.nodes.find((n) => n.title === "Task")!;
    const subtask = result.nodes.find((n) => n.title === "Subtask")!;
    expect(subtask.parentId).toBe(task.id);
  });

  it("multiplos epics mantêm tasks separadas", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({ type: "epic", title: "Epic A", level: 2 }),
      makeBlock({ type: "task", title: "Task A.1", level: 3 }),
      makeBlock({ type: "epic", title: "Epic B", level: 2 }),
      makeBlock({ type: "task", title: "Task B.1", level: 3 }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const epicA = result.nodes.find((n) => n.title === "Epic A")!;
    const epicB = result.nodes.find((n) => n.title === "Epic B")!;
    const taskA1 = result.nodes.find((n) => n.title === "Task A.1")!;
    const taskB1 = result.nodes.find((n) => n.title === "Task B.1")!;

    expect(taskA1.parentId).toBe(epicA.id);
    expect(taskB1.parentId).toBe(epicB.id);
  });

  it("sections de mesmo nível consecutivas são siblings, não parent-child", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({ type: "task", title: "Task 1", level: 2 }),
      makeBlock({ type: "task", title: "Task 2", level: 2 }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const task1 = result.nodes.find((n) => n.title === "Task 1")!;
    const task2 = result.nodes.find((n) => n.title === "Task 2")!;
    expect(task1.parentId).toBeFalsy();
    expect(task2.parentId).toBeFalsy();
  });

  // ── Issue #2: AC nodes linkam ao parent mais próximo ───

  it("AC nodes órfãos linkam ao epic/task mais próximo anterior, não a todos", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({ type: "epic", title: "Epic 1", level: 2 }),
      makeBlock({ type: "epic", title: "Epic 2", level: 2 }),
      makeBlock({ type: "acceptance_criteria", title: "AC for Epic 2", level: 2 }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const epic2 = result.nodes.find((n) => n.title === "Epic 2")!;
    const ac = result.nodes.find((n) => n.title === "AC for Epic 2")!;
    const implementsEdges = result.edges.filter((e) => e.relationType === "implements");

    // Should only link to the nearest previous epic (Epic 2), not all epics
    expect(implementsEdges).toHaveLength(1);
    expect(implementsEdges[0].from).toBe(ac.id);
    expect(implementsEdges[0].to).toBe(epic2.id);
  });

  // ── Issue #3: child_of reciprocal edges on item children ──

  it("cria child_of recíproco junto com parent_of para items filhos", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({
        type: "epic",
        title: "Parent Epic",
        items: [makeItem({ type: "task", text: "Child Task" })],
      }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const parentNode = result.nodes.find((n) => n.title === "Parent Epic")!;
    const childNode = result.nodes.find((n) => n.title === "Child Task")!;

    const parentOf = result.edges.filter((e) => e.relationType === "parent_of");
    const childOf = result.edges.filter((e) => e.relationType === "child_of");

    expect(parentOf).toHaveLength(1);
    expect(childOf).toHaveLength(1);
    expect(parentOf[0].from).toBe(parentNode.id);
    expect(parentOf[0].to).toBe(childNode.id);
    expect(childOf[0].from).toBe(childNode.id);
    expect(childOf[0].to).toBe(parentNode.id);
  });

  // ── Issue #4: Constraints scoped ao parent ─────────────

  it("constraints linkam apenas a tasks do mesmo parent (siblings)", () => {
    // Arrange — Constraint e Task A sob Epic A, Task B sob Epic B
    const extraction = makeExtraction([
      makeBlock({ type: "epic", title: "Epic A", level: 2 }),
      makeBlock({ type: "constraint", title: "Constraint A", level: 3 }),
      makeBlock({ type: "task", title: "Task A", level: 3 }),
      makeBlock({ type: "epic", title: "Epic B", level: 2 }),
      makeBlock({ type: "task", title: "Task B", level: 3 }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const constraintNode = result.nodes.find((n) => n.title === "Constraint A")!;
    const taskA = result.nodes.find((n) => n.title === "Task A")!;
    const _taskB = result.nodes.find((n) => n.title === "Task B")!;

    const relatedEdges = result.edges.filter((e) => e.relationType === "related_to" && e.from === constraintNode.id);
    // Should only link to Task A (same parent), not Task B (different parent)
    expect(relatedEdges).toHaveLength(1);
    expect(relatedEdges[0].to).toBe(taskA.id);
  });

  // ── Bug 3: xpSize extraction from description ──────────

  it("extrai xpSize do description com **Size:** M", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({
        type: "task",
        title: "Task with size",
        description: "**Size:** M\nDescricao da task",
      }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const node = result.nodes.find((n) => n.title === "Task with size")!;
    expect(node.xpSize).toBe("M");
  });

  it("extrai xpSize do description com **Tamanho:** L", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({
        type: "task",
        title: "Task PT",
        description: "**Tamanho:** L",
      }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    expect(result.nodes[0].xpSize).toBe("L");
  });

  it("nao seta xpSize quando description nao tem Size", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({
        type: "task",
        title: "No size",
        description: "Just a normal description",
      }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    expect(result.nodes[0].xpSize).toBeUndefined();
  });

  it("nao seta xpSize para valor invalido como HUGE", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({
        type: "task",
        title: "Invalid size",
        description: "**Size:** HUGE",
      }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    expect(result.nodes[0].xpSize).toBeUndefined();
  });

  // ── Bug 4: Explicit **Depends on:** creates edges ─────

  it("cria edge depends_on a partir de **Depends on:** explicito", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({ type: "task", title: "Setup Database", level: 2 }),
      makeBlock({
        type: "task",
        title: "Build API",
        description: "**Depends on:** Setup Database",
        level: 2,
      }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const buildApi = result.nodes.find((n) => n.title === "Build API")!;
    const setupDb = result.nodes.find((n) => n.title === "Setup Database")!;
    const explicitDeps = result.edges.filter(
      (e) => e.relationType === "depends_on" && !e.metadata?.inferred,
    );
    expect(explicitDeps.length).toBeGreaterThanOrEqual(1);
    expect(explicitDeps.some((e) => e.from === buildApi.id && e.to === setupDb.id)).toBe(true);
  });

  it("cria edge depends_on a partir de **Depende de:** (PT)", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({ type: "task", title: "Configurar DB", level: 2 }),
      makeBlock({
        type: "task",
        title: "Criar API",
        description: "**Depende de:** Configurar DB",
        level: 2,
      }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const criarApi = result.nodes.find((n) => n.title === "Criar API")!;
    const configurarDb = result.nodes.find((n) => n.title === "Configurar DB")!;
    const explicitDeps = result.edges.filter(
      (e) => e.relationType === "depends_on" && !e.metadata?.inferred,
    );
    expect(explicitDeps.some((e) => e.from === criarApi.id && e.to === configurarDb.id)).toBe(true);
  });

  it("cria multiplas edges para deps separadas por virgula", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({ type: "task", title: "Task A", level: 2 }),
      makeBlock({ type: "task", title: "Task B", level: 2 }),
      makeBlock({
        type: "task",
        title: "Task C",
        description: "**Depends on:** Task A, Task B",
        level: 2,
      }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const taskA = result.nodes.find((n) => n.title === "Task A")!;
    const taskB = result.nodes.find((n) => n.title === "Task B")!;
    const taskC = result.nodes.find((n) => n.title === "Task C")!;
    const explicitDeps = result.edges.filter(
      (e) => e.relationType === "depends_on" && !e.metadata?.inferred,
    );
    expect(explicitDeps.some((e) => e.from === taskC.id && e.to === taskA.id)).toBe(true);
    expect(explicitDeps.some((e) => e.from === taskC.id && e.to === taskB.id)).toBe(true);
  });

  it("ignora referencia a task inexistente no Depends on (graceful)", () => {
    // Arrange
    const extraction = makeExtraction([
      makeBlock({
        type: "task",
        title: "Task A",
        description: "**Depends on:** Nonexistent Task",
        level: 2,
      }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const explicitDeps = result.edges.filter(
      (e) => e.relationType === "depends_on" && !e.metadata?.inferred,
    );
    expect(explicitDeps).toHaveLength(0);
  });

  it("constraints sem parent linkam a todos os tasks (fallback)", () => {
    // Arrange — all at level 2, no parent hierarchy
    const extraction = makeExtraction([
      makeBlock({ type: "constraint", title: "Global Constraint", level: 2 }),
      makeBlock({ type: "task", title: "Task 1", level: 2 }),
      makeBlock({ type: "task", title: "Task 2", level: 2 }),
    ]);

    // Act
    const result = convertToGraph(extraction, "prd.md");

    // Assert
    const constraintNode = result.nodes.find((n) => n.title === "Global Constraint")!;
    const relatedEdges = result.edges.filter((e) => e.relationType === "related_to" && e.from === constraintNode.id);
    expect(relatedEdges).toHaveLength(2);
  });
});
