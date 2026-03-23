import { describe, it, expect, beforeEach } from "vitest";
import { SqliteStore } from "../core/store/sqlite-store.js";
import { JourneyStore } from "../core/journey/journey-store.js";

describe("JourneyStore", () => {
  let store: SqliteStore;
  let journeyStore: JourneyStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Test");
    const project = store.getProject()!;
    journeyStore = new JourneyStore(store.getDb(), project.id);
  });

  describe("Maps", () => {
    it("should create a journey map", () => {
      const map = journeyStore.createMap({ name: "Test Map", url: "https://example.com", description: "A test" });
      expect(map.id).toMatch(/^jmap_/);
      expect(map.name).toBe("Test Map");
      expect(map.url).toBe("https://example.com");
      expect(map.description).toBe("A test");
      expect(map.createdAt).toBeDefined();
    });

    it("should list all maps for the project", () => {
      journeyStore.createMap({ name: "Map A" });
      journeyStore.createMap({ name: "Map B" });
      const maps = journeyStore.listMaps();
      expect(maps.length).toBe(2);
    });

    it("should get a full map with screens, edges, and variants", () => {
      const map = journeyStore.createMap({ name: "Full Map" });
      journeyStore.addScreen(map.id, { title: "Screen 1", screenType: "landing" });
      const full = journeyStore.getMap(map.id);
      expect(full).not.toBeNull();
      expect(full!.screens.length).toBe(1);
      expect(full!.edges).toEqual([]);
      expect(full!.variants).toEqual([]);
    });

    it("should return null for non-existent map", () => {
      expect(journeyStore.getMap("nonexistent")).toBeNull();
    });

    it("should delete a map and cascade to screens, edges, variants", () => {
      const map = journeyStore.createMap({ name: "Cascade Test" });
      const s1 = journeyStore.addScreen(map.id, { title: "S1", screenType: "page" });
      const s2 = journeyStore.addScreen(map.id, { title: "S2", screenType: "page" });
      journeyStore.addEdge(map.id, { from: s1.id, to: s2.id });
      journeyStore.addVariant(map.id, { name: "Path A", path: [s1.id, s2.id] });

      const deleted = journeyStore.deleteMap(map.id);
      expect(deleted).toBe(true);
      expect(journeyStore.getMap(map.id)).toBeNull();
    });

    it("should return false when deleting non-existent map", () => {
      expect(journeyStore.deleteMap("nonexistent")).toBe(false);
    });
  });

  describe("Screens", () => {
    it("should add a screen with all fields", () => {
      const map = journeyStore.createMap({ name: "Test" });
      const screen = journeyStore.addScreen(map.id, {
        title: "Login",
        description: "Login form",
        screenshot: "login.png",
        url: "/login",
        screenType: "form",
        fields: [
          { name: "email", type: "email", required: true, label: "Email" },
          { name: "password", type: "password", required: true, label: "Password" },
        ],
        ctas: ["Sign In", "Forgot Password"],
        metadata: { authMethod: "jwt" },
        positionX: 100,
        positionY: 200,
      });

      expect(screen.id).toMatch(/^jscr_/);
      expect(screen.title).toBe("Login");
      expect(screen.screenType).toBe("form");
      expect(screen.fields).toHaveLength(2);
      expect(screen.ctas).toEqual(["Sign In", "Forgot Password"]);
      expect(screen.positionX).toBe(100);
      expect(screen.positionY).toBe(200);
      expect(screen.metadata).toEqual({ authMethod: "jwt" });
    });

    it("should default screenType to page and positions to 0", () => {
      const map = journeyStore.createMap({ name: "Test" });
      const screen = journeyStore.addScreen(map.id, { title: "Default" });
      expect(screen.screenType).toBe("page");
      expect(screen.positionX).toBe(0);
      expect(screen.positionY).toBe(0);
    });

    it("should update a screen partially", () => {
      const map = journeyStore.createMap({ name: "Test" });
      const screen = journeyStore.addScreen(map.id, { title: "Original", screenType: "page" });

      const updated = journeyStore.updateScreen(screen.id, { title: "Updated", positionX: 50 });
      expect(updated).not.toBeNull();
      expect(updated!.title).toBe("Updated");
      expect(updated!.positionX).toBe(50);
      expect(updated!.screenType).toBe("page"); // preserved
    });

    it("should return null when updating non-existent screen", () => {
      expect(journeyStore.updateScreen("nonexistent", { title: "X" })).toBeNull();
    });

    it("should delete a screen", () => {
      const map = journeyStore.createMap({ name: "Test" });
      const screen = journeyStore.addScreen(map.id, { title: "ToDelete", screenType: "page" });
      expect(journeyStore.deleteScreen(screen.id)).toBe(true);

      const full = journeyStore.getMap(map.id);
      expect(full!.screens.length).toBe(0);
    });

    it("should return false when deleting non-existent screen", () => {
      expect(journeyStore.deleteScreen("nonexistent")).toBe(false);
    });
  });

  describe("Edges", () => {
    it("should create an edge between screens", () => {
      const map = journeyStore.createMap({ name: "Test" });
      const s1 = journeyStore.addScreen(map.id, { title: "From", screenType: "page" });
      const s2 = journeyStore.addScreen(map.id, { title: "To", screenType: "page" });

      const edge = journeyStore.addEdge(map.id, {
        from: s1.id, to: s2.id, label: "Click Next", type: "navigation",
      });
      expect(edge.id).toMatch(/^jedg_/);
      expect(edge.from).toBe(s1.id);
      expect(edge.to).toBe(s2.id);
      expect(edge.label).toBe("Click Next");
      expect(edge.type).toBe("navigation");
    });

    it("should default edge type to navigation", () => {
      const map = journeyStore.createMap({ name: "Test" });
      const s1 = journeyStore.addScreen(map.id, { title: "A", screenType: "page" });
      const s2 = journeyStore.addScreen(map.id, { title: "B", screenType: "page" });
      const edge = journeyStore.addEdge(map.id, { from: s1.id, to: s2.id });
      expect(edge.type).toBe("navigation");
    });

    it("should delete an edge", () => {
      const map = journeyStore.createMap({ name: "Test" });
      const s1 = journeyStore.addScreen(map.id, { title: "A", screenType: "page" });
      const s2 = journeyStore.addScreen(map.id, { title: "B", screenType: "page" });
      const edge = journeyStore.addEdge(map.id, { from: s1.id, to: s2.id });

      expect(journeyStore.deleteEdge(edge.id)).toBe(true);
      const full = journeyStore.getMap(map.id);
      expect(full!.edges.length).toBe(0);
    });

    it("should return false when deleting non-existent edge", () => {
      expect(journeyStore.deleteEdge("nonexistent")).toBe(false);
    });
  });

  describe("Variants", () => {
    it("should add a variant with a path", () => {
      const map = journeyStore.createMap({ name: "Test" });
      const s1 = journeyStore.addScreen(map.id, { title: "Start", screenType: "landing" });
      const s2 = journeyStore.addScreen(map.id, { title: "End", screenType: "success" });

      const variant = journeyStore.addVariant(map.id, {
        name: "Happy Path",
        description: "Direct conversion",
        path: [s1.id, s2.id],
      });
      expect(variant.id).toMatch(/^jvar_/);
      expect(variant.name).toBe("Happy Path");
      expect(variant.path).toEqual([s1.id, s2.id]);
    });
  });

  describe("Import", () => {
    it("should import a full journey map with ID remapping", () => {
      const result = journeyStore.importJourneyMap({
        journey: { name: "Imported", url: "https://example.com" },
        screens: [
          { id: "old-1", title: "Home", screenType: "landing", ctas: ["Go"] },
          { id: "old-2", title: "Form", screenType: "form", fields: [{ name: "email", type: "email" }] },
        ],
        edges: [
          { from: "old-1", to: "old-2", label: "CTA: Go", type: "navigation" },
        ],
        variants: {
          A: { name: "Direct", path: ["old-1", "old-2"] },
        },
      });

      expect(result.id).toMatch(/^jmap_/);
      expect(result.screensCreated).toBe(2);
      expect(result.edgesCreated).toBe(1);

      // Verify the map was fully created with remapped IDs
      const full = journeyStore.getMap(result.id);
      expect(full).not.toBeNull();
      expect(full!.screens.length).toBe(2);
      expect(full!.edges.length).toBe(1);
      expect(full!.variants.length).toBe(1);

      // Edges should reference NEW screen IDs, not old ones
      const edge = full!.edges[0];
      expect(edge.from).not.toBe("old-1");
      expect(edge.to).not.toBe("old-2");
      expect(edge.from).toMatch(/^jscr_/);
      expect(edge.to).toMatch(/^jscr_/);

      // Variant path should also be remapped
      const variant = full!.variants[0];
      expect(variant.path[0]).toMatch(/^jscr_/);
      expect(variant.path[1]).toMatch(/^jscr_/);
    });

    it("should preserve fields and CTAs through import", () => {
      const result = journeyStore.importJourneyMap({
        journey: { name: "Fields Test" },
        screens: [
          {
            title: "Registration",
            screenType: "form",
            fields: [
              { name: "name", type: "text", required: true, label: "Full Name" },
              { name: "age", type: "number", required: false, label: "Age" },
            ],
            ctas: ["Submit", "Cancel"],
          },
        ],
        edges: [],
      });

      const full = journeyStore.getMap(result.id);
      const screen = full!.screens[0];
      expect(screen.fields).toHaveLength(2);
      expect(screen.fields![0].name).toBe("name");
      expect(screen.fields![0].required).toBe(true);
      expect(screen.ctas).toEqual(["Submit", "Cancel"]);
    });
  });
});
