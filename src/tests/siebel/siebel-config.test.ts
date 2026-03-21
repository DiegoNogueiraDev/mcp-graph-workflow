import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadSiebelConfig,
  saveSiebelConfig,
  addEnvironment,
  removeEnvironment,
} from "../../core/siebel/siebel-config.js";
import type { SiebelEnvironment } from "../../schemas/siebel.schema.js";

describe("siebel-config", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "siebel-config-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const devEnv: SiebelEnvironment = {
    name: "DEV",
    url: "https://siebel-dev.example.com",
    version: "15.0",
    type: "dev",
    composerUrl: "https://siebel-dev.example.com/composer",
  };

  const testEnv: SiebelEnvironment = {
    name: "TEST",
    url: "https://siebel-test.example.com",
    version: "15.0",
    type: "test",
  };

  describe("loadSiebelConfig", () => {
    it("should return empty array when no config exists", () => {
      const envs = loadSiebelConfig(tempDir);
      expect(envs).toEqual([]);
    });

    it("should load saved config", () => {
      saveSiebelConfig(tempDir, [devEnv]);
      const envs = loadSiebelConfig(tempDir);
      expect(envs).toHaveLength(1);
      expect(envs[0].name).toBe("DEV");
    });
  });

  describe("saveSiebelConfig", () => {
    it("should persist environments to file", () => {
      saveSiebelConfig(tempDir, [devEnv, testEnv]);

      const raw = readFileSync(join(tempDir, "siebel-envs.json"), "utf-8");
      const data = JSON.parse(raw);
      expect(data.environments).toHaveLength(2);
    });
  });

  describe("addEnvironment", () => {
    it("should add a new environment", () => {
      saveSiebelConfig(tempDir, []);
      addEnvironment(tempDir, devEnv);

      const envs = loadSiebelConfig(tempDir);
      expect(envs).toHaveLength(1);
      expect(envs[0].name).toBe("DEV");
    });

    it("should throw on duplicate name", () => {
      saveSiebelConfig(tempDir, [devEnv]);
      expect(() => addEnvironment(tempDir, devEnv)).toThrow("already exists");
    });
  });

  describe("removeEnvironment", () => {
    it("should remove an environment by name", () => {
      saveSiebelConfig(tempDir, [devEnv, testEnv]);
      removeEnvironment(tempDir, "DEV");

      const envs = loadSiebelConfig(tempDir);
      expect(envs).toHaveLength(1);
      expect(envs[0].name).toBe("TEST");
    });

    it("should throw when name not found", () => {
      saveSiebelConfig(tempDir, [devEnv]);
      expect(() => removeEnvironment(tempDir, "NONEXISTENT")).toThrow("not found");
    });
  });
});
