import { describe, it, expect } from "vitest";
import { buildComposerInstructions, createComposerResult } from "../../core/siebel/composer-automation.js";
import type { SiebelEnvironment } from "../../schemas/siebel.schema.js";

const mockEnv: SiebelEnvironment = {
  name: "DEV",
  url: "https://siebel-dev.example.com",
  version: "15.0",
  type: "dev",
  composerUrl: "https://siebel-dev.example.com/composer",
};

describe("composer-automation", () => {
  describe("buildComposerInstructions", () => {
    it("should build navigate instructions", () => {
      const result = buildComposerInstructions({
        env: mockEnv,
        action: "navigate",
      });

      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.steps[0]).toEqual({
        type: "navigate",
        url: "https://siebel-dev.example.com/composer",
      });
      expect(result.description).toContain("Navigate");
    });

    it("should build navigate instructions with object name", () => {
      const result = buildComposerInstructions({
        env: mockEnv,
        action: "navigate",
        objectName: "Account List Applet",
      });

      expect(result.steps.length).toBeGreaterThan(1);
      expect(result.description).toContain("Account List Applet");
    });

    it("should build import_sif instructions", () => {
      const result = buildComposerInstructions({
        env: mockEnv,
        action: "import_sif",
        sifPath: "/path/to/file.sif",
      });

      expect(result.steps.length).toBeGreaterThan(3);
      const uploadStep = result.steps.find((s) => s.type === "upload");
      expect(uploadStep).toBeDefined();
      expect(result.description).toContain("Import SIF");
    });

    it("should throw if import_sif without sifPath", () => {
      expect(() =>
        buildComposerInstructions({
          env: mockEnv,
          action: "import_sif",
        }),
      ).toThrow("sifPath");
    });

    it("should build edit instructions", () => {
      const result = buildComposerInstructions({
        env: mockEnv,
        action: "edit",
        objectName: "Account List Applet",
        property: "CAPTION",
        value: "Accounts",
      });

      expect(result.steps.length).toBeGreaterThan(4);
      const typeStep = result.steps.find((s) => s.type === "type");
      expect(typeStep).toBeDefined();
      expect(result.description).toContain("Edit");
    });

    it("should throw if edit without required params", () => {
      expect(() =>
        buildComposerInstructions({
          env: mockEnv,
          action: "edit",
          objectName: "Account",
        }),
      ).toThrow();
    });

    it("should build publish instructions", () => {
      const result = buildComposerInstructions({
        env: mockEnv,
        action: "publish",
      });

      expect(result.steps.length).toBeGreaterThan(2);
      expect(result.description).toContain("Publish");
    });

    it("should build capture instructions", () => {
      const result = buildComposerInstructions({
        env: mockEnv,
        action: "capture",
      });

      const screenshotStep = result.steps.find((s) => s.type === "screenshot");
      expect(screenshotStep).toBeDefined();
      expect(result.description).toContain("Capture");
    });

    it("should use env URL as fallback when composerUrl not set", () => {
      const envWithoutComposer: SiebelEnvironment = {
        name: "TEST",
        url: "https://siebel-test.example.com",
        version: "15.0",
        type: "test",
      };

      const result = buildComposerInstructions({
        env: envWithoutComposer,
        action: "navigate",
      });

      expect(result.steps[0]).toEqual({
        type: "navigate",
        url: "https://siebel-test.example.com/composer",
      });
    });
  });

  describe("createComposerResult", () => {
    it("should create a result object", () => {
      const result = createComposerResult("navigate", true, "Success");

      expect(result.action).toBe("navigate");
      expect(result.success).toBe(true);
      expect(result.message).toBe("Success");
      expect(result.timestamp).toBeTruthy();
    });
  });
});
