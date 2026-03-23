import { describe, it, expect } from "vitest";
import { convertSifToGraph } from "../../core/siebel/sif-to-graph.js";
import { parseSifContent } from "../../core/siebel/sif-parser.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SAMPLE_SIF_PATH = resolve(import.meta.dirname, "../fixtures/sample.sif");
const SAMPLE_SIF_CONTENT = readFileSync(SAMPLE_SIF_PATH, "utf-8");

describe("sif-to-graph", () => {
  const parseResult = parseSifContent(SAMPLE_SIF_CONTENT, "sample.sif");

  describe("convertSifToGraph", () => {
    it("should convert SIF objects into graph nodes", () => {
      const result = convertSifToGraph(parseResult);

      expect(result.nodes.length).toBeGreaterThan(0);
      // Should have an epic for the project + nodes for each object
      const epicNodes = result.nodes.filter((n) => n.type === "epic");
      expect(epicNodes.length).toBe(1);
      expect(epicNodes[0].title).toContain("Account (SSE)");
    });

    it("should map Siebel BCs, BOs, Workflows, BS to task nodes", () => {
      const result = convertSifToGraph(parseResult);

      const taskNodes = result.nodes.filter((n) => n.type === "task");
      const titles = taskNodes.map((n) => n.title);
      expect(titles).toContain("Account"); // BC
      expect(titles).toContain("Contact"); // BC
      expect(titles).toContain("Account Update Workflow"); // Workflow
      expect(titles).toContain("Account Update BS"); // Business Service
    });

    it("should map Siebel Applets, Views, Screens to subtask nodes", () => {
      const result = convertSifToGraph(parseResult);

      const subtaskNodes = result.nodes.filter((n) => n.type === "subtask");
      const titles = subtaskNodes.map((n) => n.title);
      expect(titles).toContain("Account List Applet");
      expect(titles).toContain("Account Form Applet");
      expect(titles).toContain("Account List View");
      expect(titles).toContain("Account Detail View");
      expect(titles).toContain("Accounts Screen");
    });

    it("should set parent epic on all child nodes", () => {
      const result = convertSifToGraph(parseResult);

      const epic = result.nodes.find((n) => n.type === "epic");
      const nonEpicNodes = result.nodes.filter((n) => n.type !== "epic");

      for (const node of nonEpicNodes) {
        expect(node.parentId).toBe(epic!.id);
      }
    });

    it("should create edges from Siebel dependencies", () => {
      const result = convertSifToGraph(parseResult);

      expect(result.edges.length).toBeGreaterThan(0);

      // Check at least one depends_on edge exists
      const dependsOnEdges = result.edges.filter((e) => e.relationType === "depends_on");
      expect(dependsOnEdges.length).toBeGreaterThan(0);
    });

    it("should tag nodes with siebel and object type", () => {
      const result = convertSifToGraph(parseResult);

      for (const node of result.nodes) {
        expect(node.tags).toContain("siebel");
      }

      const bcNode = result.nodes.find((n) => n.title === "Account" && n.type === "task");
      expect(bcNode?.tags).toContain("business_component");
    });

    it("should store Siebel metadata on nodes", () => {
      const result = convertSifToGraph(parseResult);

      const bcNode = result.nodes.find((n) => n.title === "Account" && n.type === "task");
      expect(bcNode?.metadata).toBeDefined();
      expect(bcNode?.metadata?.siebelType).toBe("business_component");
      expect(bcNode?.metadata?.siebelProject).toBe("Account (SSE)");
    });

    it("should set sourceRef to SIF file", () => {
      const result = convertSifToGraph(parseResult);

      for (const node of result.nodes) {
        expect(node.sourceRef?.file).toBe("sample.sif");
      }
    });

    it("should handle empty parse result", () => {
      const emptyResult = {
        metadata: {
          fileName: "empty.sif",
          objectCount: 0,
          objectTypes: [],
          extractedAt: new Date().toISOString(),
        },
        objects: [],
        dependencies: [],
      };

      const result = convertSifToGraph(emptyResult);
      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });
  });
});
