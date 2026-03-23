import { describe, it, expect } from "vitest";
import { parseSifContent, parseSifFile } from "../../core/siebel/sif-parser.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SAMPLE_SIF_PATH = resolve(import.meta.dirname, "../fixtures/sample.sif");
const SAMPLE_SIF_CONTENT = readFileSync(SAMPLE_SIF_PATH, "utf-8");

describe("sif-parser", () => {
  describe("parseSifContent", () => {
    it("should parse valid SIF XML and return metadata", () => {
      const result = parseSifContent(SAMPLE_SIF_CONTENT, "sample.sif");

      expect(result.metadata.fileName).toBe("sample.sif");
      expect(result.metadata.repositoryName).toBe("Siebel Repository");
      expect(result.metadata.projectName).toBe("Account (SSE)");
      expect(result.metadata.objectCount).toBeGreaterThan(0);
      expect(result.metadata.extractedAt).toBeTruthy();
    });

    it("should extract all top-level Siebel objects", () => {
      const result = parseSifContent(SAMPLE_SIF_CONTENT, "sample.sif");

      const types = result.objects.map((o) => o.type);
      expect(types).toContain("applet");
      expect(types).toContain("business_component");
      expect(types).toContain("business_object");
      expect(types).toContain("view");
      expect(types).toContain("screen");
      expect(types).toContain("workflow");
      expect(types).toContain("business_service");
      expect(types).toContain("integration_object");
      expect(types).toContain("web_template");
    });

    it("should extract applet objects with properties", () => {
      const result = parseSifContent(SAMPLE_SIF_CONTENT, "sample.sif");
      const applet = result.objects.find(
        (o) => o.type === "applet" && o.name === "Account List Applet",
      );

      expect(applet).toBeDefined();
      expect(applet!.project).toBe("Account (SSE)");
      expect(applet!.properties).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "BUS_COMP", value: "Account" }),
          expect.objectContaining({ name: "CLASS", value: "CSSFrameList" }),
        ]),
      );
    });

    it("should extract child objects (fields, controls, list columns)", () => {
      const result = parseSifContent(SAMPLE_SIF_CONTENT, "sample.sif");
      const applet = result.objects.find(
        (o) => o.type === "applet" && o.name === "Account List Applet",
      );

      expect(applet).toBeDefined();
      expect(applet!.children.length).toBeGreaterThan(0);

      const controlChildren = applet!.children.filter((c) => c.type === "control");
      expect(controlChildren.length).toBe(2);

      const listColumnChildren = applet!.children.filter((c) => c.type === "list_column");
      expect(listColumnChildren.length).toBe(2);
    });

    it("should extract business component with fields and links", () => {
      const result = parseSifContent(SAMPLE_SIF_CONTENT, "sample.sif");
      const bc = result.objects.find(
        (o) => o.type === "business_component" && o.name === "Account",
      );

      expect(bc).toBeDefined();
      expect(bc!.properties).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: "TABLE", value: "S_ORG_EXT" }),
        ]),
      );

      const fields = bc!.children.filter((c) => c.type === "field");
      expect(fields.length).toBe(3);

      const links = bc!.children.filter((c) => c.type === "link");
      expect(links.length).toBe(1);
    });

    it("should infer dependencies between objects", () => {
      const result = parseSifContent(SAMPLE_SIF_CONTENT, "sample.sif");

      expect(result.dependencies.length).toBeGreaterThan(0);

      // Applet → BC dependency (BUS_COMP attribute)
      const appletBcDep = result.dependencies.find(
        (d) =>
          d.from.name === "Account List Applet" &&
          d.from.type === "applet" &&
          d.to.name === "Account" &&
          d.to.type === "business_component",
      );
      expect(appletBcDep).toBeDefined();
      expect(appletBcDep!.relationType).toBe("references");

      // View → BO dependency
      const viewBoDep = result.dependencies.find(
        (d) =>
          d.from.name === "Account List View" &&
          d.from.type === "view" &&
          d.to.name === "Account" &&
          d.to.type === "business_object",
      );
      expect(viewBoDep).toBeDefined();

      // View → Applet dependency
      const viewAppletDep = result.dependencies.find(
        (d) =>
          d.from.name === "Account List View" &&
          d.from.type === "view" &&
          d.to.name === "Account List Applet" &&
          d.to.type === "applet",
      );
      expect(viewAppletDep).toBeDefined();
    });

    it("should extract workflow with steps", () => {
      const result = parseSifContent(SAMPLE_SIF_CONTENT, "sample.sif");
      const workflow = result.objects.find(
        (o) => o.type === "workflow" && o.name === "Account Update Workflow",
      );

      expect(workflow).toBeDefined();
      expect(workflow!.children.length).toBeGreaterThan(0);
    });

    it("should throw on empty content", () => {
      expect(() => parseSifContent("", "empty.sif")).toThrow();
    });

    it("should throw on invalid XML", () => {
      expect(() => parseSifContent("<invalid>not closed", "bad.sif")).toThrow();
    });

    it("should report object types in metadata", () => {
      const result = parseSifContent(SAMPLE_SIF_CONTENT, "sample.sif");

      expect(result.metadata.objectTypes).toEqual(
        expect.arrayContaining([
          "applet",
          "business_component",
          "business_object",
          "view",
        ]),
      );
    });
  });

  describe("parseSifFile", () => {
    it("should parse SIF from file path", async () => {
      const result = await parseSifFile(SAMPLE_SIF_PATH);

      expect(result.metadata.fileName).toContain("sample.sif");
      expect(result.objects.length).toBeGreaterThan(0);
    });

    it("should throw on non-existent file", async () => {
      await expect(parseSifFile("/nonexistent/file.sif")).rejects.toThrow();
    });
  });
});
