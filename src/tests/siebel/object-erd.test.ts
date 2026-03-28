import { describe, it, expect } from "vitest";
import {
  generateSiebelErd,
} from "../../core/siebel/object-erd.js";
import type { SiebelObject } from "../../schemas/siebel.schema.js";

function makeObj(name: string, type: SiebelObject["type"], props: Record<string, string> = {}, children: SiebelObject[] = []): SiebelObject {
  return { name, type, properties: Object.entries(props).map(([k, v]) => ({ name: k, value: v })), children };
}

describe("object-erd", () => {
  it("should extract tables and columns from BCs", () => {
    const objects = [
      makeObj("CX Account BC", "business_component", { TABLE: "S_ORG_EXT" }, [
        makeObj("Name", "field", { COLUMN: "NAME" }),
        makeObj("Status", "field", { COLUMN: "STATUS_CD" }),
      ]),
    ];

    const result = generateSiebelErd(objects);

    expect(result.tables.length).toBeGreaterThanOrEqual(1);
    expect(result.tables[0].name).toBe("S_ORG_EXT");
    expect(result.tables[0].columns.length).toBe(2);
  });

  it("should identify relationships via LINK elements", () => {
    const objects = [
      makeObj("CX Account BC", "business_component", { TABLE: "S_ORG_EXT" }, [
        makeObj("Account Contact", "link", { CHILD_BC: "CX Contact BC", SOURCE_FIELD: "Id", DEST_FIELD: "Account Id" }),
      ]),
      makeObj("CX Contact BC", "business_component", { TABLE: "S_CONTACT" }),
    ];

    const result = generateSiebelErd(objects);

    expect(result.relationships.length).toBeGreaterThanOrEqual(1);
    expect(result.relationships[0].fromTable).toBe("S_ORG_EXT");
    expect(result.relationships[0].toTable).toBe("S_CONTACT");
  });

  it("should generate Mermaid ER diagram", () => {
    const objects = [
      makeObj("CX Account BC", "business_component", { TABLE: "S_ORG_EXT" }, [
        makeObj("Name", "field", { COLUMN: "NAME" }),
      ]),
    ];

    const result = generateSiebelErd(objects);

    expect(result.mermaid).toContain("erDiagram");
    expect(result.mermaid).toContain("S_ORG_EXT");
  });

  it("should filter by project when specified", () => {
    const objects = [
      makeObj("CX Account BC", "business_component", { TABLE: "S_ORG_EXT" }),
      { ...makeObj("Other BC", "business_component", { TABLE: "S_OTHER" }), project: "Other" },
    ];
    objects[0] = { ...objects[0], project: "CX" };

    const result = generateSiebelErd(objects, "CX");

    expect(result.tables.length).toBe(1);
    expect(result.tables[0].name).toBe("S_ORG_EXT");
  });

  it("should handle empty objects", () => {
    const result = generateSiebelErd([]);

    expect(result.tables).toHaveLength(0);
    expect(result.relationships).toHaveLength(0);
    expect(result.mermaid).toContain("erDiagram");
  });
});
