import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";

describe("Multi-project support", () => {
  let store: SqliteStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
  });

  afterEach(() => {
    store.close();
  });

  describe("listProjects", () => {
    it("should return empty list when no projects exist", () => {
      const projects = store.listProjects();
      expect(projects).toEqual([]);
    });

    it("should return all projects", () => {
      store.initProject("Project A");
      store.initProject("Project B");

      const projects = store.listProjects();
      expect(projects).toHaveLength(2);
      expect(projects.map((p) => p.name)).toContain("Project A");
      expect(projects.map((p) => p.name)).toContain("Project B");
    });
  });

  describe("activateProject", () => {
    it("should switch active project", () => {
      const projectA = store.initProject("Project A");
      const projectB = store.initProject("Project B");

      // Active project should be B (last initialized)
      expect(store.getProject()!.name).toBe("Project B");

      // Switch to A
      store.activateProject(projectA.id);
      expect(store.getProject()!.name).toBe("Project A");

      // Switch back to B
      store.activateProject(projectB.id);
      expect(store.getProject()!.name).toBe("Project B");
    });

    it("should throw on invalid project ID", () => {
      expect(() => store.activateProject("invalid_id")).toThrow();
    });
  });

  describe("getActiveProject", () => {
    it("should return null when no project is active", () => {
      expect(store.getActiveProject()).toBeNull();
    });

    it("should return the active project", () => {
      store.initProject("My Project");
      const active = store.getActiveProject();
      expect(active).not.toBeNull();
      expect(active!.name).toBe("My Project");
    });
  });

  describe("initProject with existing project", () => {
    it("should create a new project when called with a different name", () => {
      store.initProject("Project A");
      const projectB = store.initProject("Project B");

      expect(projectB.name).toBe("Project B");
      expect(store.getProject()!.name).toBe("Project B");

      const projects = store.listProjects();
      expect(projects).toHaveLength(2);
    });

    it("should return existing project when called with same name", () => {
      const first = store.initProject("Same Name");
      const second = store.initProject("Same Name");

      expect(second.id).toBe(first.id);
      expect(store.listProjects()).toHaveLength(1);
    });

    it("should return existing project when called with no name", () => {
      const first = store.initProject("Existing");
      const second = store.initProject();

      expect(second.id).toBe(first.id);
    });
  });

  describe("project isolation", () => {
    it("should only return nodes for the active project", () => {
      const projectA = store.initProject("Project A");
      store.insertNode({
        id: "node_a1",
        type: "task",
        title: "Task in A",
        status: "backlog",
        priority: 3,
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      });

      // Switch to project B
      store.initProject("Project B");
      store.insertNode({
        id: "node_b1",
        type: "task",
        title: "Task in B",
        status: "backlog",
        priority: 3,
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      });

      // Project B should only see its own nodes
      let nodes = store.getAllNodes();
      expect(nodes).toHaveLength(1);
      expect(nodes[0].title).toBe("Task in B");

      // Switch to project A
      store.activateProject(projectA.id);
      nodes = store.getAllNodes();
      expect(nodes).toHaveLength(1);
      expect(nodes[0].title).toBe("Task in A");
    });
  });
});
