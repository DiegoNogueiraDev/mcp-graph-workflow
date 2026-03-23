import { describe, it, expect } from "vitest";
import {
  buildSifXml,
  getTemplate,
  listTemplates,
  type SifTemplateObject,
} from "../../core/siebel/sif-templates.js";
import { parseSifContent } from "../../core/siebel/sif-parser.js";

describe("sif-templates", () => {
  describe("listTemplates", () => {
    it("should return templates for all generatable object types", () => {
      const templates = listTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(8);

      const types = templates.map((t) => t.type);
      expect(types).toContain("applet");
      expect(types).toContain("business_component");
      expect(types).toContain("business_object");
      expect(types).toContain("view");
      expect(types).toContain("screen");
      expect(types).toContain("workflow");
      expect(types).toContain("business_service");
      expect(types).toContain("integration_object");
    });

    it("should include required and optional attributes for each template", () => {
      const templates = listTemplates();

      for (const template of templates) {
        expect(template.type).toBeTruthy();
        expect(template.requiredAttrs.length).toBeGreaterThan(0);
        // NAME is always required
        expect(template.requiredAttrs).toContain("NAME");
      }
    });
  });

  describe("getTemplate", () => {
    it("should return the correct template for a given type", () => {
      const bcTemplate = getTemplate("business_component");
      expect(bcTemplate.type).toBe("business_component");
      expect(bcTemplate.xmlTag).toBe("BUSINESS_COMPONENT");
      expect(bcTemplate.requiredAttrs).toContain("NAME");
      expect(bcTemplate.requiredAttrs).toContain("TABLE");
    });

    it("should return applet template with correct attributes", () => {
      const template = getTemplate("applet");
      expect(template.xmlTag).toBe("APPLET");
      expect(template.requiredAttrs).toContain("NAME");
      expect(template.requiredAttrs).toContain("BUS_COMP");
    });

    it("should return undefined for non-generatable types", () => {
      const template = getTemplate("field" as never);
      expect(template).toBeUndefined();
    });
  });

  describe("buildSifXml", () => {
    it("should generate valid SIF XML for a single business component", () => {
      const objects: SifTemplateObject[] = [
        {
          type: "business_component",
          name: "Service Request",
          projectName: "Service (SSE)",
          attributes: { TABLE: "S_SRV_REQ", CLASS: "CSSBCBase" },
          children: [
            { tag: "FIELD", attributes: { NAME: "SR Number", COLUMN: "SR_NUM", TYPE: "DTYPE_TEXT" } },
            { tag: "FIELD", attributes: { NAME: "Status", COLUMN: "STATUS_CD", TYPE: "DTYPE_TEXT" } },
          ],
        },
      ];

      const xml = buildSifXml(objects);

      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain("REPOSITORY");
      expect(xml).toContain("PROJECT");
      expect(xml).toContain("BUSINESS_COMPONENT");
      expect(xml).toContain('NAME="Service Request"');
      expect(xml).toContain('TABLE="S_SRV_REQ"');
      expect(xml).toContain("FIELD");
      expect(xml).toContain('NAME="SR Number"');
    });

    it("should generate XML that can be re-parsed by sif-parser (round-trip)", () => {
      const objects: SifTemplateObject[] = [
        {
          type: "applet",
          name: "Test List Applet",
          projectName: "Test Project",
          attributes: { BUS_COMP: "TestBC", CLASS: "CSSFrameList" },
          children: [
            { tag: "CONTROL", attributes: { NAME: "Name", FIELD: "Name", HTML_TYPE: "Text" } },
            { tag: "LIST_COLUMN", attributes: { NAME: "Name", FIELD: "Name", DISPLAY_NAME: "Name" } },
          ],
        },
        {
          type: "business_component",
          name: "TestBC",
          projectName: "Test Project",
          attributes: { TABLE: "S_TEST", CLASS: "CSSBCBase" },
          children: [
            { tag: "FIELD", attributes: { NAME: "Name", COLUMN: "NAME", TYPE: "DTYPE_TEXT" } },
          ],
        },
      ];

      const xml = buildSifXml(objects);

      // Re-parse the generated XML
      const parseResult = parseSifContent(xml, "generated.sif");

      expect(parseResult.objects.length).toBe(2);

      const applet = parseResult.objects.find((o) => o.type === "applet");
      expect(applet).toBeDefined();
      expect(applet!.name).toBe("Test List Applet");
      expect(applet!.properties.find((p) => p.name === "BUS_COMP")?.value).toBe("TestBC");

      const bc = parseResult.objects.find((o) => o.type === "business_component");
      expect(bc).toBeDefined();
      expect(bc!.name).toBe("TestBC");
      expect(bc!.children.length).toBeGreaterThan(0);
    });

    it("should handle multiple objects in the same project", () => {
      const objects: SifTemplateObject[] = [
        {
          type: "view",
          name: "Test List View",
          projectName: "Test Project",
          attributes: { BUS_OBJECT: "TestBO" },
          children: [
            { tag: "VIEW_APPLET", attributes: { NAME: "Test Applet", APPLET: "Test Applet" } },
          ],
        },
        {
          type: "screen",
          name: "Test Screen",
          projectName: "Test Project",
          attributes: {},
          children: [
            { tag: "SCREEN_VIEW", attributes: { NAME: "Test List View", VIEW: "Test List View" } },
          ],
        },
      ];

      const xml = buildSifXml(objects);
      const parseResult = parseSifContent(xml, "multi.sif");

      expect(parseResult.objects.length).toBe(2);
      expect(parseResult.objects.map((o) => o.type)).toContain("view");
      expect(parseResult.objects.map((o) => o.type)).toContain("screen");
    });

    it("should handle objects from different projects", () => {
      const objects: SifTemplateObject[] = [
        {
          type: "business_component",
          name: "BC1",
          projectName: "Project A",
          attributes: { TABLE: "S_A" },
        },
        {
          type: "business_component",
          name: "BC2",
          projectName: "Project B",
          attributes: { TABLE: "S_B" },
        },
      ];

      const xml = buildSifXml(objects);

      // Should have two PROJECT elements
      expect(xml).toContain('NAME="Project A"');
      expect(xml).toContain('NAME="Project B"');

      const parseResult = parseSifContent(xml, "multi-project.sif");
      expect(parseResult.objects.length).toBe(2);
    });

    it("should generate valid workflow template", () => {
      const objects: SifTemplateObject[] = [
        {
          type: "workflow",
          name: "Order Processing",
          projectName: "Order (SSE)",
          attributes: { BUS_OBJECT: "Order Entry" },
          children: [
            { tag: "WORKFLOW_STEP", attributes: { NAME: "Start", TYPE: "Start" } },
            { tag: "WORKFLOW_STEP", attributes: { NAME: "Validate", TYPE: "Business Service", BUS_SERVICE: "Order Validate BS" } },
            { tag: "WORKFLOW_STEP", attributes: { NAME: "End", TYPE: "End" } },
          ],
        },
      ];

      const xml = buildSifXml(objects);
      const parseResult = parseSifContent(xml, "workflow.sif");

      const wf = parseResult.objects.find((o) => o.type === "workflow");
      expect(wf).toBeDefined();
      expect(wf!.name).toBe("Order Processing");
      expect(wf!.children.length).toBe(3);
    });

    it("should return empty SIF for empty objects array", () => {
      const xml = buildSifXml([]);
      expect(xml).toContain("REPOSITORY");
      // Should still be valid XML, just empty
      const parseResult = parseSifContent(xml, "empty.sif");
      expect(parseResult.objects.length).toBe(0);
    });
  });
});
