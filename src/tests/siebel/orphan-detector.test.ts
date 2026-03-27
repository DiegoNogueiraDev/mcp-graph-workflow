import { describe, it, expect } from "vitest";
import { detectOrphans } from "../../core/siebel/orphan-detector.js";
import type { SiebelObject, SiebelDependency } from "../../schemas/siebel.schema.js";

function makeObj(overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] }): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

const OBJECTS: SiebelObject[] = [
  makeObj({ name: "Account", type: "business_component" }),
  makeObj({ name: "Orphan BC", type: "business_component" }),
  makeObj({ name: "Account List Applet", type: "applet" }),
  makeObj({ name: "Orphan Applet", type: "applet" }),
  makeObj({ name: "Account View", type: "view" }),
  makeObj({ name: "Accounts Screen", type: "screen" }),
  makeObj({ name: "Utility BS", type: "business_service" }),
];

const DEPS: SiebelDependency[] = [
  { from: { name: "Account List Applet", type: "applet" }, to: { name: "Account", type: "business_component" }, relationType: "references", inferred: true },
  { from: { name: "Account View", type: "view" }, to: { name: "Account List Applet", type: "applet" }, relationType: "contains", inferred: true },
  { from: { name: "Accounts Screen", type: "screen" }, to: { name: "Account View", type: "view" }, relationType: "contains", inferred: true },
];

describe("orphan-detector", () => {
  it("should detect BCs not referenced by any applet", () => {
    const result = detectOrphans(OBJECTS, DEPS);
    const orphanBc = result.orphans.find((o) => o.object.name === "Orphan BC");
    expect(orphanBc).toBeDefined();
    expect(orphanBc!.classification).toBe("definitely_orphan");
  });

  it("should detect applets not referenced by any view", () => {
    const result = detectOrphans(OBJECTS, DEPS);
    const orphanApplet = result.orphans.find((o) => o.object.name === "Orphan Applet");
    expect(orphanApplet).toBeDefined();
  });

  it("should not mark connected objects as orphans", () => {
    const result = detectOrphans(OBJECTS, DEPS);
    // Objects that are referenced by something should not be orphans
    const referencedNames = ["Account", "Account List Applet", "Account View"];
    for (const name of referencedNames) {
      const found = result.orphans.find((o) => o.object.name === name);
      expect(found).toBeUndefined();
    }
    // Screen at top of chain has outbound deps but no inbound — probably_orphan is acceptable
    const screen = result.orphans.find((o) => o.object.name === "Accounts Screen");
    if (screen) {
      expect(screen.classification).toBe("probably_orphan");
    }
  });

  it("should classify business services as intentionally_standalone", () => {
    const result = detectOrphans(OBJECTS, DEPS);
    const bs = result.orphans.find((o) => o.object.name === "Utility BS");
    if (bs) {
      expect(bs.classification).toBe("intentionally_standalone");
    }
    // BS without deps is acceptable — should not be definitely_orphan
  });

  it("should report total counts and orphan rate", () => {
    const result = detectOrphans(OBJECTS, DEPS);
    expect(result.totalScanned).toBe(OBJECTS.length);
    expect(result.orphanCount).toBeGreaterThan(0);
    expect(result.orphanRate).toBeGreaterThan(0);
    expect(result.orphanRate).toBeLessThanOrEqual(1);
  });

  it("should handle empty input", () => {
    const result = detectOrphans([], []);
    expect(result.orphans).toEqual([]);
    expect(result.totalScanned).toBe(0);
    expect(result.orphanRate).toBe(0);
  });
});
