import { describe, it, expect } from "vitest";
import {
  SifGenerationRequestSchema,
  SifGenerationResultSchema,
  SifValidationResultSchema,
  SifTemplateTypeSchema,
} from "../../schemas/siebel.schema.js";

describe("SIF generation schemas", () => {
  describe("SifGenerationRequestSchema", () => {
    it("should validate a minimal generation request", () => {
      const input = {
        description: "Create a new BC for Service Requests",
        objectTypes: ["business_component"],
      };

      const result = SifGenerationRequestSchema.parse(input);
      expect(result.description).toBe(input.description);
      expect(result.objectTypes).toEqual(["business_component"]);
    });

    it("should validate a full generation request with optional fields", () => {
      const input = {
        description: "Add Account applet and view",
        objectTypes: ["applet", "view"],
        basedOnProject: "Account (SSE)",
        properties: { BUS_COMP: "Account", BUS_OBJECT: "Account" },
      };

      const result = SifGenerationRequestSchema.parse(input);
      expect(result.basedOnProject).toBe("Account (SSE)");
      expect(result.properties).toEqual(input.properties);
    });

    it("should reject empty description", () => {
      expect(() => SifGenerationRequestSchema.parse({
        description: "",
        objectTypes: ["applet"],
      })).toThrow();
    });

    it("should reject empty objectTypes array", () => {
      expect(() => SifGenerationRequestSchema.parse({
        description: "Some request",
        objectTypes: [],
      })).toThrow();
    });

    it("should reject invalid object types", () => {
      expect(() => SifGenerationRequestSchema.parse({
        description: "Some request",
        objectTypes: ["invalid_type"],
      })).toThrow();
    });
  });

  describe("SifValidationResultSchema", () => {
    it("should validate a valid result", () => {
      const input = {
        status: "valid" as const,
        messages: [],
        score: 100,
      };

      const result = SifValidationResultSchema.parse(input);
      expect(result.status).toBe("valid");
      expect(result.score).toBe(100);
    });

    it("should validate a result with warnings", () => {
      const input = {
        status: "warnings" as const,
        messages: [
          { level: "warning" as const, message: "BC without TABLE", objectName: "MyBC" },
        ],
        score: 75,
      };

      const result = SifValidationResultSchema.parse(input);
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].level).toBe("warning");
    });

    it("should validate a result with errors", () => {
      const input = {
        status: "invalid" as const,
        messages: [
          { level: "error" as const, message: "Name collision", objectName: "Account" },
        ],
        score: 20,
      };

      const result = SifValidationResultSchema.parse(input);
      expect(result.status).toBe("invalid");
    });

    it("should enforce score range 0-100", () => {
      expect(() => SifValidationResultSchema.parse({
        status: "valid",
        messages: [],
        score: 150,
      })).toThrow();

      expect(() => SifValidationResultSchema.parse({
        status: "valid",
        messages: [],
        score: -10,
      })).toThrow();
    });
  });

  describe("SifGenerationResultSchema", () => {
    it("should validate a complete generation result", () => {
      const input = {
        sifContent: "<REPOSITORY><PROJECT></PROJECT></REPOSITORY>",
        objects: [{ name: "Account", type: "business_component" }],
        validation: {
          status: "valid" as const,
          messages: [],
          score: 95,
        },
        metadata: {
          generatedAt: new Date().toISOString(),
          requestDescription: "Create Account BC",
          objectCount: 1,
        },
      };

      const result = SifGenerationResultSchema.parse(input);
      expect(result.sifContent).toContain("REPOSITORY");
      expect(result.objects).toHaveLength(1);
      expect(result.validation.status).toBe("valid");
    });
  });

  describe("SifTemplateTypeSchema", () => {
    it("should include all generatable Siebel object types", () => {
      const types = SifTemplateTypeSchema.options;
      expect(types).toContain("applet");
      expect(types).toContain("business_component");
      expect(types).toContain("business_object");
      expect(types).toContain("view");
      expect(types).toContain("screen");
      expect(types).toContain("workflow");
      expect(types).toContain("business_service");
      expect(types).toContain("integration_object");
    });
  });
});
