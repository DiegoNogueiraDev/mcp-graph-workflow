import { describe, it, expect } from "vitest";
import { convertToGraph } from "../core/importer/prd-to-graph.js";
import type { ExtractionResult } from "../core/parser/extract.js";

function makeExtraction(blocks: Array<{
  type: string;
  title: string;
  description?: string;
  items?: Array<{ type: string; text: string; line: number; confidence: number }>;
  level?: number;
  startLine?: number;
  endLine?: number;
  confidence?: number;
}>): ExtractionResult {
  return {
    blocks: blocks.map((b) => ({
      type: b.type,
      title: b.title,
      description: b.description ?? "",
      items: b.items ?? [],
      level: b.level ?? 2,
      startLine: b.startLine ?? 1,
      endLine: b.endLine ?? 10,
      confidence: b.confidence ?? 0.9,
    })),
  };
}

describe("BUG-05: extractPriority from PRD", () => {
  it("should extract high priority", () => {
    const extraction = makeExtraction([{
      type: "task",
      title: "Setup CI",
      description: "Configure CI pipeline.\n**Priority:** high",
    }]);
    const result = convertToGraph(extraction, "test.md");
    const node = result.nodes.find((n) => n.title === "Setup CI");
    expect(node?.priority).toBe(1);
  });

  it("should extract baixa priority (pt-BR)", () => {
    const extraction = makeExtraction([{
      type: "task",
      title: "Nice to have",
      description: "Optional feature.\n**Prioridade:** baixa",
    }]);
    const result = convertToGraph(extraction, "test.md");
    const node = result.nodes.find((n) => n.title === "Nice to have");
    expect(node?.priority).toBe(5);
  });

  it("should extract numeric priority", () => {
    const extraction = makeExtraction([{
      type: "task",
      title: "Mid task",
      description: "Some task.\n**Priority:** 2",
    }]);
    const result = convertToGraph(extraction, "test.md");
    const node = result.nodes.find((n) => n.title === "Mid task");
    expect(node?.priority).toBe(2);
  });

  it("should use default priority when no match", () => {
    const extraction = makeExtraction([{
      type: "task",
      title: "Default task",
      description: "No priority defined here.",
    }]);
    const result = convertToGraph(extraction, "test.md");
    const node = result.nodes.find((n) => n.title === "Default task");
    expect(node?.priority).toBe(3); // default for task
  });
});

describe("BUG-18: extractTags from PRD", () => {
  it("should extract tags", () => {
    const extraction = makeExtraction([{
      type: "task",
      title: "Tagged task",
      description: "A task with tags.\n**Tags:** testing, infra, CI",
    }]);
    const result = convertToGraph(extraction, "test.md");
    const node = result.nodes.find((n) => n.title === "Tagged task");
    expect(node?.tags).toEqual(["testing", "infra", "ci"]);
  });

  it("should handle singular Tag", () => {
    const extraction = makeExtraction([{
      type: "task",
      title: "Single tag",
      description: "A task.\n**Tag:** frontend",
    }]);
    const result = convertToGraph(extraction, "test.md");
    const node = result.nodes.find((n) => n.title === "Single tag");
    expect(node?.tags).toEqual(["frontend"]);
  });

  it("should not set tags when no match", () => {
    const extraction = makeExtraction([{
      type: "task",
      title: "No tags",
      description: "No tags defined here.",
    }]);
    const result = convertToGraph(extraction, "test.md");
    const node = result.nodes.find((n) => n.title === "No tags");
    expect(node?.tags).toBeUndefined();
  });
});
