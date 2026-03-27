import { describe, it, expect } from "vitest";
import { analyzePatterns } from "../../core/siebel/pattern-analyzer.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

function makeObj(overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] }): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

const SAMPLE_OBJECTS: SiebelObject[] = [
  makeObj({ name: "CX Account List Applet", type: "applet", project: "Custom Account",
    properties: [{ name: "BUS_COMP", value: "Account" }, { name: "CLASS", value: "CSSFrameList" }],
    children: [
      makeObj({ name: "Name", type: "control", parentName: "CX Account List Applet" }),
      makeObj({ name: "Status", type: "control", parentName: "CX Account List Applet" }),
    ],
  }),
  makeObj({ name: "CX Account Form Applet", type: "applet", project: "Custom Account",
    properties: [{ name: "BUS_COMP", value: "Account" }, { name: "CLASS", value: "CSSFrameBase" }],
    children: [
      makeObj({ name: "Name", type: "control", parentName: "CX Account Form Applet" }),
      makeObj({ name: "Location", type: "control", parentName: "CX Account Form Applet" }),
      makeObj({ name: "Phone", type: "control", parentName: "CX Account Form Applet" }),
    ],
  }),
  makeObj({ name: "CX Contact Form Applet", type: "applet", project: "Custom Contact",
    properties: [{ name: "BUS_COMP", value: "Contact" }, { name: "CLASS", value: "CSSFrameBase" }],
    children: [],
  }),
  makeObj({ name: "Account", type: "business_component", project: "Custom Account",
    properties: [{ name: "TABLE", value: "S_ORG_EXT" }, { name: "CLASS", value: "CSSBCBase" }],
    children: [
      makeObj({ name: "Name", type: "field", parentName: "Account" }),
      makeObj({ name: "Status", type: "field", parentName: "Account" }),
      makeObj({ name: "Location", type: "field", parentName: "Account" }),
    ],
  }),
  makeObj({ name: "Contact", type: "business_component", project: "Custom Contact",
    properties: [{ name: "TABLE", value: "S_CONTACT" }, { name: "CLASS", value: "CSSBCBase" }],
    children: [
      makeObj({ name: "First Name", type: "field", parentName: "Contact" }),
      makeObj({ name: "Last Name", type: "field", parentName: "Contact" }),
    ],
  }),
  makeObj({ name: "Order Entry", type: "applet", project: "Order Management",
    properties: [{ name: "BUS_COMP", value: "Order" }, { name: "CLASS", value: "CSSFrameBase" }],
    children: [],
  }),
];

describe("pattern-analyzer", () => {
  it("should extract naming prefix patterns per project", () => {
    const result = analyzePatterns(SAMPLE_OBJECTS);
    expect(result.namingPatterns.length).toBeGreaterThan(0);

    const cxPattern = result.namingPatterns.find((p) => p.prefix === "CX");
    expect(cxPattern).toBeDefined();
    expect(cxPattern!.count).toBeGreaterThanOrEqual(3);
  });

  it("should identify required properties per object type", () => {
    const result = analyzePatterns(SAMPLE_OBJECTS);

    const appletProps = result.requiredProperties.find((r) => r.objectType === "applet");
    expect(appletProps).toBeDefined();
    expect(appletProps!.properties).toContain("BUS_COMP");
    expect(appletProps!.properties).toContain("CLASS");

    const bcProps = result.requiredProperties.find((r) => r.objectType === "business_component");
    expect(bcProps).toBeDefined();
    expect(bcProps!.properties).toContain("TABLE");
  });

  it("should calculate field distribution per BC", () => {
    const result = analyzePatterns(SAMPLE_OBJECTS);
    expect(result.fieldDistribution).toBeDefined();
    expect(result.fieldDistribution.avgFieldCount).toBeGreaterThan(0);
    expect(result.fieldDistribution.maxFieldCount).toBe(3);
    expect(result.fieldDistribution.minFieldCount).toBe(2);
  });

  it("should detect applet class patterns (Form vs List)", () => {
    const result = analyzePatterns(SAMPLE_OBJECTS);
    expect(result.appletClassDistribution).toBeDefined();
    expect(result.appletClassDistribution["CSSFrameBase"]).toBe(3);
    expect(result.appletClassDistribution["CSSFrameList"]).toBe(1);
  });

  it("should compute adherence score for a new object", () => {
    const result = analyzePatterns(SAMPLE_OBJECTS);

    const goodObj = makeObj({
      name: "CX Order Form Applet", type: "applet", project: "Order Management",
      properties: [{ name: "BUS_COMP", value: "Order" }, { name: "CLASS", value: "CSSFrameBase" }],
    });
    const goodScore = result.computeAdherence(goodObj);
    expect(goodScore).toBeGreaterThanOrEqual(50);

    const badObj = makeObj({
      name: "random thing", type: "applet",
      properties: [],
    });
    const badScore = result.computeAdherence(badObj);
    expect(badScore).toBeLessThan(goodScore);
  });

  it("should handle empty input", () => {
    const result = analyzePatterns([]);
    expect(result.namingPatterns).toEqual([]);
    expect(result.requiredProperties).toEqual([]);
    expect(result.fieldDistribution.avgFieldCount).toBe(0);
  });
});
