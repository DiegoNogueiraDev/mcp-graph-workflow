import { describe, it, expect } from "vitest";
import { simulateChange } from "../../core/siebel/change-simulator.js";
import type { SiebelObject, SiebelDependency } from "../../schemas/siebel.schema.js";

function makeObj(overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] }): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

const OBJECTS: SiebelObject[] = [
  makeObj({ name: "Account", type: "business_component",
    properties: [{ name: "TABLE", value: "S_ORG_EXT" }],
    children: [
      makeObj({ name: "Name", type: "field", parentName: "Account" }),
      makeObj({ name: "Status", type: "field", parentName: "Account" }),
    ],
  }),
  makeObj({ name: "Account List Applet", type: "applet",
    properties: [{ name: "BUS_COMP", value: "Account" }],
    children: [
      makeObj({ name: "Name", type: "control", parentName: "Account List Applet",
        properties: [{ name: "FIELD", value: "Name" }] }),
      makeObj({ name: "Status", type: "control", parentName: "Account List Applet",
        properties: [{ name: "FIELD", value: "Status" }] }),
    ],
  }),
  makeObj({ name: "Account Detail View", type: "view",
    properties: [{ name: "BUS_OBJECT", value: "Account" }],
  }),
  makeObj({ name: "Accounts Screen", type: "screen" }),
];

const DEPS: SiebelDependency[] = [
  { from: { name: "Account List Applet", type: "applet" }, to: { name: "Account", type: "business_component" }, relationType: "references", inferred: true },
  { from: { name: "Account Detail View", type: "view" }, to: { name: "Account List Applet", type: "applet" }, relationType: "contains", inferred: true },
  { from: { name: "Accounts Screen", type: "screen" }, to: { name: "Account Detail View", type: "view" }, relationType: "contains", inferred: true },
];

describe("change-simulator", () => {
  it("should simulate removing a field and identify affected controls", () => {
    const result = simulateChange(OBJECTS, DEPS, {
      action: "remove_field",
      targetObject: { name: "Account", type: "business_component" },
      fieldName: "Status",
    });

    expect(result.affectedObjects.length).toBeGreaterThan(0);
    const appletAffected = result.affectedObjects.find((a) => a.object.name === "Account List Applet");
    expect(appletAffected).toBeDefined();
    expect(appletAffected!.severity).toBe("breaking");
  });

  it("should propagate impact through dependency chain BC→Applet→View→Screen", () => {
    const result = simulateChange(OBJECTS, DEPS, {
      action: "remove_field",
      targetObject: { name: "Account", type: "business_component" },
      fieldName: "Name",
    });

    const names = result.affectedObjects.map((a) => a.object.name);
    expect(names).toContain("Account List Applet");
    expect(names).toContain("Account Detail View");
    expect(names).toContain("Accounts Screen");
  });

  it("should classify severity levels", () => {
    const result = simulateChange(OBJECTS, DEPS, {
      action: "remove_field",
      targetObject: { name: "Account", type: "business_component" },
      fieldName: "Name",
    });

    const applet = result.affectedObjects.find((a) => a.object.name === "Account List Applet");
    expect(applet!.severity).toBe("breaking");

    const screen = result.affectedObjects.find((a) => a.object.name === "Accounts Screen");
    expect(screen!.severity).toBe("info");
  });

  it("should suggest actions for affected objects", () => {
    const result = simulateChange(OBJECTS, DEPS, {
      action: "remove_field",
      targetObject: { name: "Account", type: "business_component" },
      fieldName: "Status",
    });

    const applet = result.affectedObjects.find((a) => a.object.name === "Account List Applet");
    expect(applet!.suggestedAction).toBe("update");
  });

  it("should handle add_field with info severity", () => {
    const result = simulateChange(OBJECTS, DEPS, {
      action: "add_field",
      targetObject: { name: "Account", type: "business_component" },
      fieldName: "Phone",
    });

    expect(result.riskLevel).toBe("low");
    // Adding a field doesn't break anything
    expect(result.affectedObjects.every((a) => a.severity === "info")).toBe(true);
  });

  it("should calculate overall risk score", () => {
    const result = simulateChange(OBJECTS, DEPS, {
      action: "remove_field",
      targetObject: { name: "Account", type: "business_component" },
      fieldName: "Name",
    });

    expect(result.riskScore).toBeGreaterThan(0);
    expect(result.riskLevel).toBe("high");
  });

  it("should handle rename_field", () => {
    const result = simulateChange(OBJECTS, DEPS, {
      action: "rename_field",
      targetObject: { name: "Account", type: "business_component" },
      fieldName: "Status",
      newFieldName: "Account Status",
    });

    expect(result.affectedObjects.length).toBeGreaterThan(0);
    const applet = result.affectedObjects.find((a) => a.object.name === "Account List Applet");
    expect(applet!.severity).toBe("breaking");
  });

  it("should return empty for unknown target", () => {
    const result = simulateChange(OBJECTS, DEPS, {
      action: "remove_field",
      targetObject: { name: "NonExistent", type: "business_component" },
      fieldName: "Name",
    });

    expect(result.affectedObjects.length).toBe(0);
    expect(result.riskLevel).toBe("low");
  });
});
