import { describe, it, expect } from "vitest";
import {
  learnTemplates,
  type LearnedTemplate,
} from "../../core/siebel/template-learner.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

function makeObj(
  overrides: Partial<SiebelObject> & { name: string; type: SiebelObject["type"] },
): SiebelObject {
  return { properties: [], children: [], ...overrides };
}

const SAMPLE_APPLETS: SiebelObject[] = [
  makeObj({
    name: "CX Account List Applet", type: "applet", project: "Custom",
    properties: [
      { name: "BUS_COMP", value: "Account" },
      { name: "CLASS", value: "CSSFrameList" },
      { name: "COMMENTS", value: "List applet for accounts" },
    ],
    children: [
      makeObj({ name: "Name", type: "list_column", parentName: "CX Account List Applet",
        properties: [{ name: "FIELD", value: "Name" }, { name: "WIDTH", value: "200" }] }),
      makeObj({ name: "Status", type: "list_column", parentName: "CX Account List Applet",
        properties: [{ name: "FIELD", value: "Status" }, { name: "WIDTH", value: "100" }] }),
    ],
  }),
  makeObj({
    name: "CX Contact List Applet", type: "applet", project: "Custom",
    properties: [
      { name: "BUS_COMP", value: "Contact" },
      { name: "CLASS", value: "CSSFrameList" },
      { name: "COMMENTS", value: "List applet for contacts" },
    ],
    children: [
      makeObj({ name: "First Name", type: "list_column", parentName: "CX Contact List Applet",
        properties: [{ name: "FIELD", value: "First Name" }, { name: "WIDTH", value: "150" }] }),
      makeObj({ name: "Last Name", type: "list_column", parentName: "CX Contact List Applet",
        properties: [{ name: "FIELD", value: "Last Name" }, { name: "WIDTH", value: "150" }] }),
      makeObj({ name: "Email", type: "list_column", parentName: "CX Contact List Applet",
        properties: [{ name: "FIELD", value: "Email" }, { name: "WIDTH", value: "200" }] }),
    ],
  }),
  makeObj({
    name: "CX Order Form Applet", type: "applet", project: "Custom",
    properties: [
      { name: "BUS_COMP", value: "Order" },
      { name: "CLASS", value: "CSSFrameBase" },
    ],
    children: [
      makeObj({ name: "Order Number", type: "control", parentName: "CX Order Form Applet",
        properties: [{ name: "FIELD", value: "Order Number" }] }),
    ],
  }),
];

const SAMPLE_BCS: SiebelObject[] = [
  makeObj({
    name: "CX Account", type: "business_component", project: "Custom",
    properties: [
      { name: "TABLE", value: "S_ORG_EXT" },
      { name: "CLASS", value: "CSSBCBase" },
    ],
    children: [
      makeObj({ name: "Name", type: "field", parentName: "CX Account",
        properties: [{ name: "COLUMN", value: "NAME" }, { name: "TYPE", value: "DTYPE_TEXT" }] }),
      makeObj({ name: "Status", type: "field", parentName: "CX Account",
        properties: [{ name: "COLUMN", value: "STATUS_CD" }, { name: "TYPE", value: "DTYPE_TEXT" }] }),
    ],
  }),
  makeObj({
    name: "CX Contact", type: "business_component", project: "Custom",
    properties: [
      { name: "TABLE", value: "S_CONTACT" },
      { name: "CLASS", value: "CSSBCBase" },
    ],
    children: [
      makeObj({ name: "First Name", type: "field", parentName: "CX Contact",
        properties: [{ name: "COLUMN", value: "FST_NAME" }, { name: "TYPE", value: "DTYPE_TEXT" }] }),
    ],
  }),
];

describe("template-learner", () => {
  it("should learn templates grouped by object type and subtype (class)", () => {
    const templates = learnTemplates([...SAMPLE_APPLETS, ...SAMPLE_BCS]);

    expect(templates.length).toBeGreaterThan(0);

    const listAppletTemplate = templates.find(
      (t) => t.objectType === "applet" && t.subType === "CSSFrameList",
    );
    expect(listAppletTemplate).toBeDefined();
    expect(listAppletTemplate!.sampleCount).toBe(2);
  });

  it("should extract common properties from learned templates", () => {
    const templates = learnTemplates([...SAMPLE_APPLETS, ...SAMPLE_BCS]);

    const listTemplate = templates.find(
      (t) => t.objectType === "applet" && t.subType === "CSSFrameList",
    );
    expect(listTemplate).toBeDefined();
    // BUS_COMP and CLASS are in 100% of list applets
    expect(listTemplate!.commonProperties.map((p) => p.name)).toContain("BUS_COMP");
    expect(listTemplate!.commonProperties.map((p) => p.name)).toContain("CLASS");
  });

  it("should extract common child structure from learned templates", () => {
    const templates = learnTemplates([...SAMPLE_APPLETS, ...SAMPLE_BCS]);

    const listTemplate = templates.find(
      (t) => t.objectType === "applet" && t.subType === "CSSFrameList",
    );
    expect(listTemplate).toBeDefined();
    // List applets have list_column children
    expect(listTemplate!.commonChildTypes).toContain("list_column");
    expect(listTemplate!.avgChildCount).toBeGreaterThan(0);
  });

  it("should learn BC templates with field children", () => {
    const templates = learnTemplates([...SAMPLE_APPLETS, ...SAMPLE_BCS]);

    const bcTemplate = templates.find((t) => t.objectType === "business_component");
    expect(bcTemplate).toBeDefined();
    expect(bcTemplate!.commonProperties.map((p) => p.name)).toContain("TABLE");
    expect(bcTemplate!.commonChildTypes).toContain("field");
  });

  it("should compute adherence score for new objects against learned templates", () => {
    const templates = learnTemplates([...SAMPLE_APPLETS, ...SAMPLE_BCS]);

    const goodApplet = makeObj({
      name: "CX New List Applet", type: "applet",
      properties: [
        { name: "BUS_COMP", value: "Opportunity" },
        { name: "CLASS", value: "CSSFrameList" },
      ],
    });

    const badApplet = makeObj({
      name: "random", type: "applet",
      properties: [],
    });

    const listTemplate = templates.find(
      (t) => t.objectType === "applet" && t.subType === "CSSFrameList",
    )!;

    expect(listTemplate.computeAdherence(goodApplet)).toBeGreaterThan(
      listTemplate.computeAdherence(badApplet),
    );
  });

  it("should handle empty input", () => {
    const templates = learnTemplates([]);
    expect(templates).toEqual([]);
  });

  it("should handle objects without CLASS (use 'default' subType)", () => {
    const objects: SiebelObject[] = [
      makeObj({
        name: "CX My View", type: "view",
        properties: [{ name: "BUS_OBJECT", value: "Account" }],
        children: [],
      }),
    ];

    const templates = learnTemplates(objects);
    const viewTemplate = templates.find((t) => t.objectType === "view");
    expect(viewTemplate).toBeDefined();
    expect(viewTemplate!.subType).toBe("default");
  });
});
