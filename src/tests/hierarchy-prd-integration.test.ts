/**
 * Integration test: PRD with heading hierarchy → extractEntities → convertToGraph → verify parent-child relationships.
 * Also tests dashboard hierarchy utility functions (buildChildrenMap, getVisibleNodes).
 */
import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileContent } from "../core/parser/file-reader.js";
import { extractEntities } from "../core/parser/extract.js";
import { convertToGraph } from "../core/importer/prd-to-graph.js";
import {
  buildChildrenMap,
  getVisibleNodes,
  getRootNodes,
} from "../web/dashboard/src/lib/graph-hierarchy.js";
import type { GraphNode } from "../core/graph/graph-types.js";
import type { GraphEdge } from "../core/graph/graph-types.js";
import type { GraphNode as DashNode, GraphEdge as DashEdge } from "../web/dashboard/src/lib/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "fixtures", "hierarchy-prd.md");

describe("PRD Heading Hierarchy Integration", () => {
  let nodes: GraphNode[];
  let edges: GraphEdge[];

  beforeAll(async () => {
    const result = await readFileContent(fixturePath);
    const entities = extractEntities(result.text);
    const graph = convertToGraph(entities, fixturePath);
    nodes = graph.nodes;
    edges = graph.edges;
  });

  it("should parse the hierarchy PRD fixture producing nodes and edges", () => {
    expect(nodes.length).toBeGreaterThan(0);
    expect(edges.length).toBeGreaterThan(0);
  });

  describe("heading-based parent assignment (Pass 1.5)", () => {
    it("should create the h1 project node as the only true root", () => {
      const platform = nodes.find((n) => n.title === "E-Commerce Platform");
      expect(platform).toBeDefined();
      expect(platform!.parentId).toBeNull();
    });

    it("should create epic nodes from h2 headings as children of h1", () => {
      const platform = nodes.find((n) => n.title === "E-Commerce Platform");
      const epics = nodes.filter((n) => n.type === "epic" && n.parentId === platform!.id);

      const titles = epics.map((n) => n.title);
      expect(titles).toContain("Auth Epic");
      expect(titles).toContain("Catalog Epic");
    });

    it("should create task nodes from h3 headings with parentId pointing to h2 epic", () => {
      const authEpic = nodes.find((n) => n.title === "Auth Epic");
      expect(authEpic).toBeDefined();

      const loginTask = nodes.find((n) => n.title === "Login Task");
      expect(loginTask).toBeDefined();
      expect(loginTask!.parentId).toBe(authEpic!.id);

      const registerTask = nodes.find((n) => n.title === "Register Task");
      expect(registerTask).toBeDefined();
      expect(registerTask!.parentId).toBe(authEpic!.id);
    });

    it("should create task nodes from h4 headings with parentId pointing to h3 task", () => {
      const loginTask = nodes.find((n) => n.title === "Login Task");
      expect(loginTask).toBeDefined();

      const emailTask = nodes.find((n) => n.title === "Email Validation Task");
      const passwordTask = nodes.find((n) => n.title === "Password Field Task");

      expect(emailTask).toBeDefined();
      expect(passwordTask).toBeDefined();
      expect(emailTask!.parentId).toBe(loginTask!.id);
      expect(passwordTask!.parentId).toBe(loginTask!.id);
    });

    it("should create subtask nodes from bullet items with parentId pointing to h4 task", () => {
      const emailTask = nodes.find((n) => n.title === "Email Validation Task");
      expect(emailTask).toBeDefined();

      const subtasks = nodes.filter((n) => n.parentId === emailTask!.id && n.type === "subtask");
      expect(subtasks.length).toBeGreaterThanOrEqual(1);
    });

    it("should create bidirectional parent_of/child_of edges for heading hierarchy", () => {
      const authEpic = nodes.find((n) => n.title === "Auth Epic");
      const loginTask = nodes.find((n) => n.title === "Login Task");
      expect(authEpic).toBeDefined();
      expect(loginTask).toBeDefined();

      const parentOfEdge = edges.find(
        (e) => e.from === authEpic!.id && e.to === loginTask!.id && e.relationType === "parent_of",
      );
      expect(parentOfEdge).toBeDefined();

      const childOfEdge = edges.find(
        (e) => e.from === loginTask!.id && e.to === authEpic!.id && e.relationType === "child_of",
      );
      expect(childOfEdge).toBeDefined();
    });

    it("should produce a 4-level hierarchy: h1 → h2 → h3 → h4", () => {
      const platform = nodes.find((n) => n.title === "E-Commerce Platform");
      const authEpic = nodes.find((n) => n.title === "Auth Epic");
      const loginTask = nodes.find((n) => n.title === "Login Task");
      const emailTask = nodes.find((n) => n.title === "Email Validation Task");

      // Chain: platform → auth → login → email
      expect(authEpic!.parentId).toBe(platform!.id);
      expect(loginTask!.parentId).toBe(authEpic!.id);
      expect(emailTask!.parentId).toBe(loginTask!.id);
    });
  });

  describe("dashboard hierarchy utilities with real PRD data", () => {
    let dashNodes: DashNode[];
    let dashEdges: DashEdge[];
    let map: Map<string, string[]>;

    beforeAll(() => {
      dashNodes = nodes as unknown as DashNode[];
      dashEdges = edges as unknown as DashEdge[];
      map = buildChildrenMap(dashNodes, dashEdges);
    });

    it("buildChildrenMap should map h1 root to its h2 children", () => {
      const platform = nodes.find((n) => n.title === "E-Commerce Platform");
      expect(platform).toBeDefined();

      const children = map.get(platform!.id);
      expect(children).toBeDefined();
      // Auth Epic, Catalog Epic, Critérios de aceite
      expect(children!.length).toBeGreaterThanOrEqual(2);
    });

    it("buildChildrenMap should map Auth Epic to Login and Register tasks", () => {
      const authEpic = nodes.find((n) => n.title === "Auth Epic");
      expect(authEpic).toBeDefined();

      const children = map.get(authEpic!.id);
      expect(children).toBeDefined();
      expect(children!.length).toBeGreaterThanOrEqual(2);

      const loginTask = nodes.find((n) => n.title === "Login Task");
      const registerTask = nodes.find((n) => n.title === "Register Task");
      expect(children).toContain(loginTask!.id);
      expect(children).toContain(registerTask!.id);
    });

    it("getVisibleNodes with empty expanded set should return only root nodes", () => {
      const visible = getVisibleNodes(dashNodes, new Set(), map);
      const roots = getRootNodes(dashNodes);

      expect(visible.length).toBe(roots.length);
    });

    it("getVisibleNodes expanding h1 root should reveal h2 epics", () => {
      const platform = nodes.find((n) => n.title === "E-Commerce Platform");
      const authEpic = nodes.find((n) => n.title === "Auth Epic");
      const catalogEpic = nodes.find((n) => n.title === "Catalog Epic");

      const visible = getVisibleNodes(dashNodes, new Set([platform!.id]), map);
      const visibleIds = visible.map((n) => n.id);

      expect(visibleIds).toContain(platform!.id);
      expect(visibleIds).toContain(authEpic!.id);
      expect(visibleIds).toContain(catalogEpic!.id);
    });

    it("getVisibleNodes expanding h1 + h2 epic should reveal h3 tasks", () => {
      const platform = nodes.find((n) => n.title === "E-Commerce Platform");
      const authEpic = nodes.find((n) => n.title === "Auth Epic");
      const loginTask = nodes.find((n) => n.title === "Login Task");
      const registerTask = nodes.find((n) => n.title === "Register Task");

      const visible = getVisibleNodes(
        dashNodes,
        new Set([platform!.id, authEpic!.id]),
        map,
      );
      const visibleIds = visible.map((n) => n.id);

      expect(visibleIds).toContain(authEpic!.id);
      expect(visibleIds).toContain(loginTask!.id);
      expect(visibleIds).toContain(registerTask!.id);
    });

    it("getVisibleNodes expanding full chain should reveal h4 subtasks", () => {
      const platform = nodes.find((n) => n.title === "E-Commerce Platform");
      const authEpic = nodes.find((n) => n.title === "Auth Epic");
      const loginTask = nodes.find((n) => n.title === "Login Task");
      const emailTask = nodes.find((n) => n.title === "Email Validation Task");
      const passwordTask = nodes.find((n) => n.title === "Password Field Task");

      const visible = getVisibleNodes(
        dashNodes,
        new Set([platform!.id, authEpic!.id, loginTask!.id]),
        map,
      );
      const visibleIds = visible.map((n) => n.id);

      expect(visibleIds).toContain(emailTask!.id);
      expect(visibleIds).toContain(passwordTask!.id);
    });
  });
});
