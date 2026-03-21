import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  prepareSifGeneration,
  finalizeSifGeneration,
} from "../../core/siebel/sif-generator.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { SqliteStore } from "../../core/store/sqlite-store.js";
import { buildSifXml, type SifTemplateObject } from "../../core/siebel/sif-templates.js";
import type { SifGenerationRequest } from "../../schemas/siebel.schema.js";

describe("sif-generator", () => {
  let store: SqliteStore;
  let knowledgeStore: KnowledgeStore;

  beforeEach(() => {
    store = SqliteStore.open(":memory:");
    store.initProject("Generator Test");
    knowledgeStore = new KnowledgeStore(store.getDb());
  });

  afterEach(() => {
    store.close();
  });

  describe("prepareSifGeneration", () => {
    it("should return context with prompt and templates", () => {
      const request: SifGenerationRequest = {
        description: "Create a Business Component for Orders",
        objectTypes: ["business_component"],
      };

      const context = prepareSifGeneration(knowledgeStore, request);

      expect(context.prompt).toBeTruthy();
      expect(context.templates.length).toBeGreaterThan(0);
      expect(context.validationRules.length).toBeGreaterThan(0);
    });

    it("should include project name in context when provided", () => {
      const request: SifGenerationRequest = {
        description: "Create applet for Quotes",
        objectTypes: ["applet"],
        basedOnProject: "Quote (SSE)",
      };

      const context = prepareSifGeneration(knowledgeStore, request);

      expect(context.prompt).toContain("Quote (SSE)");
    });
  });

  describe("finalizeSifGeneration", () => {
    it("should validate and return result for valid generated SIF XML", () => {
      const objects: SifTemplateObject[] = [
        {
          type: "business_component",
          name: "Order Entry",
          projectName: "Order (SSE)",
          attributes: { TABLE: "S_ORDER", CLASS: "CSSBCBase" },
          children: [
            { tag: "FIELD", attributes: { NAME: "Order Number", COLUMN: "ORDER_NUM", TYPE: "DTYPE_TEXT" } },
          ],
        },
      ];
      const generatedXml = buildSifXml(objects);

      const request: SifGenerationRequest = {
        description: "Create Order BC",
        objectTypes: ["business_component"],
      };

      const result = finalizeSifGeneration(knowledgeStore, generatedXml, request);

      expect(result.sifContent).toBe(generatedXml);
      expect(result.objects.length).toBe(1);
      expect(result.objects[0].name).toBe("Order Entry");
      expect(result.validation.status).toBe("valid");
      expect(result.validation.score).toBeGreaterThanOrEqual(80);
      expect(result.metadata.objectCount).toBe(1);
      expect(result.metadata.requestDescription).toBe("Create Order BC");
    });

    it("should detect name collisions with existing indexed objects", () => {
      // Index existing Account BC
      knowledgeStore.insert({
        sourceType: "siebel_sif",
        sourceId: "siebel_sif:existing.sif",
        title: "Siebel business_component: Account",
        content: "Business Component: Account\nType: business_component\nProject: Account (SSE)",
        chunkIndex: 0,
      });

      // Generate a BC with the same name
      const objects: SifTemplateObject[] = [
        {
          type: "business_component",
          name: "Account",
          projectName: "Custom",
          attributes: { TABLE: "S_ORG_EXT" },
        },
      ];
      const generatedXml = buildSifXml(objects);

      const request: SifGenerationRequest = {
        description: "Create Account BC",
        objectTypes: ["business_component"],
      };

      const result = finalizeSifGeneration(knowledgeStore, generatedXml, request);

      // Should warn about name collision
      expect(result.validation.messages.some(
        (m) => m.level === "warning" && m.message.toLowerCase().includes("collision"),
      )).toBe(true);
    });

    it("should reject invalid XML", () => {
      const request: SifGenerationRequest = {
        description: "Test",
        objectTypes: ["business_component"],
      };

      const result = finalizeSifGeneration(knowledgeStore, "not xml at all", request);

      expect(result.validation.status).toBe("invalid");
      expect(result.validation.score).toBeLessThan(50);
      expect(result.validation.messages.some((m) => m.level === "error")).toBe(true);
    });

    it("should warn about BC without TABLE attribute", () => {
      const objects: SifTemplateObject[] = [
        {
          type: "business_component",
          name: "NoTableBC",
          projectName: "Test",
          attributes: {}, // Missing TABLE
        },
      ];
      const generatedXml = buildSifXml(objects);

      const request: SifGenerationRequest = {
        description: "Test",
        objectTypes: ["business_component"],
      };

      const result = finalizeSifGeneration(knowledgeStore, generatedXml, request);

      expect(result.validation.messages.some(
        (m) => m.message.toLowerCase().includes("table"),
      )).toBe(true);
    });

    it("should index the generated SIF into knowledge store", () => {
      const objects: SifTemplateObject[] = [
        {
          type: "business_service",
          name: "Order Validate BS",
          projectName: "Order (SSE)",
          attributes: { CLASS: "CSSService" },
          children: [
            { tag: "BUSINESS_SERVICE_METHOD", attributes: { NAME: "Validate" } },
          ],
        },
      ];
      const generatedXml = buildSifXml(objects);

      const request: SifGenerationRequest = {
        description: "Create validation service",
        objectTypes: ["business_service"],
      };

      finalizeSifGeneration(knowledgeStore, generatedXml, request);

      // Should be findable in knowledge store
      const results = knowledgeStore.search("Order Validate BS", 5);
      expect(results.length).toBeGreaterThan(0);
    });

    it("should handle multi-object generation", () => {
      const objects: SifTemplateObject[] = [
        {
          type: "business_component",
          name: "ServiceRequest",
          projectName: "Service (SSE)",
          attributes: { TABLE: "S_SRV_REQ" },
        },
        {
          type: "applet",
          name: "Service Request List Applet",
          projectName: "Service (SSE)",
          attributes: { BUS_COMP: "ServiceRequest", CLASS: "CSSFrameList" },
        },
        {
          type: "view",
          name: "Service Request List View",
          projectName: "Service (SSE)",
          attributes: { BUS_OBJECT: "Service Request" },
        },
      ];
      const generatedXml = buildSifXml(objects);

      const request: SifGenerationRequest = {
        description: "Create Service Request module",
        objectTypes: ["business_component", "applet", "view"],
      };

      const result = finalizeSifGeneration(knowledgeStore, generatedXml, request);

      expect(result.objects.length).toBe(3);
      expect(result.metadata.objectCount).toBe(3);
      expect(result.validation.status).not.toBe("invalid");
    });
  });
});
