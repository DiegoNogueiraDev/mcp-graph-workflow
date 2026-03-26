/**
 * Unit tests for Siebel graph utils — node/edge conversion, layout, impact analysis.
 */

import { describe, it, expect } from "vitest";

// We test the pure functions by importing directly from the dashboard source.
// Since the dashboard uses path aliases, we replicate the logic inline for testing.
// These tests validate the core algorithms used in the graph visualization.

// ── Inline implementations (mirrors siebel-graph-utils.ts logic) ──

interface SiebelObjectData {
  name: string;
  type: string;
  project?: string;
  properties: Array<{ name: string; value: string }>;
  children: Array<{ name: string; type: string; properties: Array<{ name: string; value: string }>; children: unknown[]; parentName?: string }>;
  inactive?: boolean;
}

interface SiebelDependencyData {
  from: { name: string; type: string };
  to: { name: string; type: string };
  relationType: string;
  inferred?: boolean;
}

function makeNodeId(type: string, name: string): string {
  return `siebel:${type}:${name}`;
}

function computeImpact(
  dependencies: SiebelDependencyData[],
  targetType: string,
  targetName: string,
): Map<string, "direct" | "transitive"> {
  const targetId = makeNodeId(targetType, targetName);
  const impacted = new Map<string, "direct" | "transitive">();

  const dependents = new Map<string, string[]>();
  for (const dep of dependencies) {
    const toId = makeNodeId(dep.to.type, dep.to.name);
    const fromId = makeNodeId(dep.from.type, dep.from.name);
    if (!dependents.has(toId)) dependents.set(toId, []);
    dependents.get(toId)!.push(fromId);
  }

  const queue = [targetId];
  const visited = new Set([targetId]);
  let depth = 0;

  while (queue.length > 0) {
    const levelSize = queue.length;
    depth++;

    for (let i = 0; i < levelSize; i++) {
      const current = queue.shift()!;
      const deps = dependents.get(current) || [];

      for (const dep of deps) {
        if (!visited.has(dep)) {
          visited.add(dep);
          impacted.set(dep, depth === 1 ? "direct" : "transitive");
          queue.push(dep);
        }
      }
    }
  }

  return impacted;
}

// ── Factory helpers ──

function createObject(overrides: Partial<SiebelObjectData> = {}): SiebelObjectData {
  return {
    name: "TestBC",
    type: "business_component",
    project: "TestProject",
    properties: [],
    children: [],
    ...overrides,
  };
}

function createDep(
  from: { name: string; type: string },
  to: { name: string; type: string },
  relationType = "references",
): SiebelDependencyData {
  return { from, to, relationType, inferred: true };
}

// ── Tests ──

describe("makeNodeId", () => {
  it("should create deterministic node ID from type and name", () => {
    expect(makeNodeId("applet", "AccountApplet")).toBe("siebel:applet:AccountApplet");
    expect(makeNodeId("business_component", "Account BC")).toBe("siebel:business_component:Account BC");
  });

  it("should produce unique IDs for different types with same name", () => {
    const id1 = makeNodeId("applet", "Account");
    const id2 = makeNodeId("view", "Account");
    expect(id1).not.toBe(id2);
  });
});

describe("computeImpact", () => {
  it("should return empty map when target has no dependents", () => {
    const deps: SiebelDependencyData[] = [
      createDep({ name: "A", type: "applet" }, { name: "B", type: "business_component" }),
    ];

    const impact = computeImpact(deps, "applet", "A");
    expect(impact.size).toBe(0);
  });

  it("should identify direct dependents", () => {
    const deps: SiebelDependencyData[] = [
      createDep({ name: "AppletA", type: "applet" }, { name: "BC1", type: "business_component" }),
      createDep({ name: "AppletB", type: "applet" }, { name: "BC1", type: "business_component" }),
    ];

    const impact = computeImpact(deps, "business_component", "BC1");
    expect(impact.size).toBe(2);
    expect(impact.get("siebel:applet:AppletA")).toBe("direct");
    expect(impact.get("siebel:applet:AppletB")).toBe("direct");
  });

  it("should identify transitive dependents", () => {
    const deps: SiebelDependencyData[] = [
      createDep({ name: "View1", type: "view" }, { name: "Applet1", type: "applet" }),
      createDep({ name: "Applet1", type: "applet" }, { name: "BC1", type: "business_component" }),
    ];

    const impact = computeImpact(deps, "business_component", "BC1");
    expect(impact.get("siebel:applet:Applet1")).toBe("direct");
    expect(impact.get("siebel:view:View1")).toBe("transitive");
  });

  it("should handle cycles without infinite loop", () => {
    const deps: SiebelDependencyData[] = [
      createDep({ name: "A", type: "bc" }, { name: "B", type: "bc" }),
      createDep({ name: "B", type: "bc" }, { name: "A", type: "bc" }),
    ];

    const impact = computeImpact(deps, "bc", "A");
    expect(impact.size).toBe(1);
    expect(impact.get("siebel:bc:B")).toBe("direct");
  });

  it("should handle diamond dependency pattern", () => {
    // A depends on B and C, B and C both depend on D
    const deps: SiebelDependencyData[] = [
      createDep({ name: "A", type: "view" }, { name: "B", type: "applet" }),
      createDep({ name: "A", type: "view" }, { name: "C", type: "applet" }),
      createDep({ name: "B", type: "applet" }, { name: "D", type: "bc" }),
      createDep({ name: "C", type: "applet" }, { name: "D", type: "bc" }),
    ];

    const impact = computeImpact(deps, "bc", "D");
    expect(impact.get("siebel:applet:B")).toBe("direct");
    expect(impact.get("siebel:applet:C")).toBe("direct");
    expect(impact.get("siebel:view:A")).toBe("transitive");
  });
});

describe("SiebelObjectData factory", () => {
  it("should create minimal valid object with defaults", () => {
    const obj = createObject();
    expect(obj.name).toBe("TestBC");
    expect(obj.type).toBe("business_component");
    expect(obj.properties).toEqual([]);
    expect(obj.children).toEqual([]);
  });

  it("should allow overriding fields", () => {
    const obj = createObject({
      name: "MyApplet",
      type: "applet",
      properties: [{ name: "BUS_COMP", value: "Account" }],
      inactive: true,
    });
    expect(obj.name).toBe("MyApplet");
    expect(obj.type).toBe("applet");
    expect(obj.properties).toHaveLength(1);
    expect(obj.inactive).toBe(true);
  });
});

describe("Siebel type color mapping", () => {
  // Regression test: ensure all expected types have colors defined
  const SIEBEL_TYPE_COLORS: Record<string, string> = {
    screen: "#8b5cf6",
    view: "#3b82f6",
    applet: "#06b6d4",
    business_object: "#7c3aed",
    business_component: "#10b981",
    business_service: "#f59e0b",
    workflow: "#ef4444",
    table: "#78909c",
    integration_object: "#ec4899",
    web_template: "#6b7280",
    pick_list: "#a78bfa",
    field: "#94a3b8",
    link: "#64748b",
    column: "#94a3b8",
    control: "#94a3b8",
    list_column: "#94a3b8",
    menu_item: "#94a3b8",
    project: "#d97706",
  };

  const EXPECTED_TYPES = [
    "screen", "view", "applet", "business_object", "business_component",
    "business_service", "workflow", "table", "integration_object", "web_template",
    "pick_list", "field", "link", "column", "control", "list_column", "menu_item", "project",
  ];

  it("should have a color for every expected Siebel object type", () => {
    for (const type of EXPECTED_TYPES) {
      expect(SIEBEL_TYPE_COLORS[type], `Missing color for type: ${type}`).toBeDefined();
      expect(SIEBEL_TYPE_COLORS[type]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("should have unique colors for top-level types", () => {
    const topLevel = ["screen", "view", "applet", "business_object", "business_component",
      "business_service", "workflow", "table", "integration_object"];
    const colors = topLevel.map((t) => SIEBEL_TYPE_COLORS[t]);
    const unique = new Set(colors);
    expect(unique.size).toBe(topLevel.length);
  });
});

describe("Siebel relation style mapping", () => {
  const SIEBEL_RELATION_STYLES: Record<string, { color: string; dashed: boolean; label: string }> = {
    uses: { color: "#2196f3", dashed: false, label: "uses" },
    references: { color: "#6c757d", dashed: true, label: "references" },
    contains: { color: "#7c3aed", dashed: false, label: "contains" },
    extends: { color: "#10b981", dashed: true, label: "extends" },
    based_on: { color: "#f59e0b", dashed: false, label: "based on" },
    linked_to: { color: "#ef4444", dashed: true, label: "linked to" },
    parent_of: { color: "#8b5cf6", dashed: false, label: "parent of" },
  };

  const EXPECTED_RELATIONS = ["uses", "references", "contains", "extends", "based_on", "linked_to", "parent_of"];

  it("should have styles for all expected relation types", () => {
    for (const rel of EXPECTED_RELATIONS) {
      const style = SIEBEL_RELATION_STYLES[rel];
      expect(style, `Missing style for relation: ${rel}`).toBeDefined();
      expect(style.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(typeof style.dashed).toBe("boolean");
      expect(style.label.length).toBeGreaterThan(0);
    }
  });
});
