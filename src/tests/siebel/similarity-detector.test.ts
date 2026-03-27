import { describe, it, expect } from "vitest";
import { detectSimilarObjects } from "../../core/siebel/similarity-detector.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

function makeObj(overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] }): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

const OBJECTS: SiebelObject[] = [
  makeObj({ name: "Account List Applet", type: "applet", project: "Custom Account",
    properties: [{ name: "BUS_COMP", value: "Account" }, { name: "CLASS", value: "CSSFrameList" }],
    children: [
      makeObj({ name: "Name", type: "control", parentName: "Account List Applet" }),
      makeObj({ name: "Status", type: "control", parentName: "Account List Applet" }),
      makeObj({ name: "Location", type: "control", parentName: "Account List Applet" }),
    ],
  }),
  makeObj({ name: "Account List Applet 2", type: "applet", project: "Custom Account",
    properties: [{ name: "BUS_COMP", value: "Account" }, { name: "CLASS", value: "CSSFrameList" }],
    children: [
      makeObj({ name: "Name", type: "control", parentName: "Account List Applet 2" }),
      makeObj({ name: "Status", type: "control", parentName: "Account List Applet 2" }),
      makeObj({ name: "Phone", type: "control", parentName: "Account List Applet 2" }),
    ],
  }),
  makeObj({ name: "Contact Form Applet", type: "applet", project: "Custom Contact",
    properties: [{ name: "BUS_COMP", value: "Contact" }, { name: "CLASS", value: "CSSFrameBase" }],
    children: [
      makeObj({ name: "First Name", type: "control", parentName: "Contact Form Applet" }),
      makeObj({ name: "Last Name", type: "control", parentName: "Contact Form Applet" }),
    ],
  }),
  makeObj({ name: "Account BC", type: "business_component", project: "Custom Account",
    properties: [{ name: "TABLE", value: "S_ORG_EXT" }],
    children: [
      makeObj({ name: "Name", type: "field", parentName: "Account BC" }),
      makeObj({ name: "Status", type: "field", parentName: "Account BC" }),
    ],
  }),
  makeObj({ name: "Account BC Copy", type: "business_component", project: "Custom Account",
    properties: [{ name: "TABLE", value: "S_ORG_EXT" }],
    children: [
      makeObj({ name: "Name", type: "field", parentName: "Account BC Copy" }),
      makeObj({ name: "Status", type: "field", parentName: "Account BC Copy" }),
    ],
  }),
];

describe("similarity-detector", () => {
  it("should detect similar applets sharing BC and controls", () => {
    const result = detectSimilarObjects(OBJECTS);
    const pair = result.pairs.find(
      (p) => (p.a.name === "Account List Applet" && p.b.name === "Account List Applet 2") ||
             (p.a.name === "Account List Applet 2" && p.b.name === "Account List Applet")
    );
    expect(pair).toBeDefined();
    expect(pair!.score).toBeGreaterThan(50);
  });

  it("should detect identical BCs with same table and fields", () => {
    const result = detectSimilarObjects(OBJECTS);
    const pair = result.pairs.find(
      (p) => (p.a.name === "Account BC" && p.b.name === "Account BC Copy") ||
             (p.a.name === "Account BC Copy" && p.b.name === "Account BC")
    );
    expect(pair).toBeDefined();
    expect(pair!.score).toBe(100);
  });

  it("should not pair dissimilar objects", () => {
    const result = detectSimilarObjects(OBJECTS, 50);
    const pair = result.pairs.find(
      (p) => (p.a.name === "Account List Applet" && p.b.name === "Contact Form Applet") ||
             (p.a.name === "Contact Form Applet" && p.b.name === "Account List Applet")
    );
    expect(pair).toBeUndefined();
  });

  it("should calculate Jaccard similarity score 0-100", () => {
    const result = detectSimilarObjects(OBJECTS);
    for (const pair of result.pairs) {
      expect(pair.score).toBeGreaterThanOrEqual(0);
      expect(pair.score).toBeLessThanOrEqual(100);
    }
  });

  it("should list shared properties in pairs", () => {
    const result = detectSimilarObjects(OBJECTS);
    const bcPair = result.pairs.find(
      (p) => p.a.name === "Account BC" || p.b.name === "Account BC"
    );
    expect(bcPair).toBeDefined();
    expect(bcPair!.sharedChildren).toContain("Name");
    expect(bcPair!.sharedChildren).toContain("Status");
  });

  it("should respect custom threshold", () => {
    const strict = detectSimilarObjects(OBJECTS, 90);
    const loose = detectSimilarObjects(OBJECTS, 30);
    expect(loose.pairs.length).toBeGreaterThanOrEqual(strict.pairs.length);
  });

  it("should handle empty input", () => {
    const result = detectSimilarObjects([]);
    expect(result.pairs).toEqual([]);
  });

  it("should only compare objects of the same type", () => {
    const result = detectSimilarObjects(OBJECTS);
    for (const pair of result.pairs) {
      expect(pair.a.type).toBe(pair.b.type);
    }
  });
});
