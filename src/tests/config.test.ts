import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { loadConfig } from "../core/config/config-loader.js";
import { ConfigSchema } from "../core/config/config-schema.js";

describe("Config layer", () => {
  let tmpDir: string;
  const originalMcpPort = process.env.MCP_PORT;
  const originalGitnexusPort = process.env.GITNEXUS_PORT;

  beforeEach(() => {
    tmpDir = path.join(tmpdir(), `config-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    delete process.env.MCP_PORT;
    delete process.env.GITNEXUS_PORT;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    if (originalMcpPort !== undefined) {
      process.env.MCP_PORT = originalMcpPort;
    } else {
      delete process.env.MCP_PORT;
    }
    if (originalGitnexusPort !== undefined) {
      process.env.GITNEXUS_PORT = originalGitnexusPort;
    } else {
      delete process.env.GITNEXUS_PORT;
    }
  });

  // ── Defaults ──────────────────────────────────────

  it("should load default config when no file exists", () => {
    const config = loadConfig(tmpDir);

    expect(config.port).toBe(3000);
    expect(config.dbPath).toBe(".mcp-graph");
    expect(config.integrations.gitnexusPort).toBe(3737);
  });

  // ── File loading ──────────────────────────────────

  it("should load and validate config file", () => {
    writeFileSync(
      path.join(tmpDir, "mcp-graph.config.json"),
      JSON.stringify({ port: 4000, dbPath: "custom-db" }),
    );

    const config = loadConfig(tmpDir);

    expect(config.port).toBe(4000);
    expect(config.dbPath).toBe("custom-db");
  });

  it("should reject invalid config via Zod schema", () => {
    expect(() => ConfigSchema.parse({ port: "not-a-number" })).toThrow();
  });

  it("should reject port out of range", () => {
    expect(() => ConfigSchema.parse({ port: 0 })).toThrow();
    expect(() => ConfigSchema.parse({ port: 99999 })).toThrow();
  });

  // ── Env var overrides ─────────────────────────────

  it("should override port from MCP_PORT env var", () => {
    writeFileSync(
      path.join(tmpDir, "mcp-graph.config.json"),
      JSON.stringify({ port: 4000 }),
    );

    process.env.MCP_PORT = "5555";
    const config = loadConfig(tmpDir);

    expect(config.port).toBe(5555);
  });

  it("should override gitnexusPort from GITNEXUS_PORT env var", () => {
    process.env.GITNEXUS_PORT = "8888";
    const config = loadConfig(tmpDir);

    expect(config.integrations.gitnexusPort).toBe(8888);
  });

  // ── Missing optional fields ───────────────────────

  it("should use defaults for missing optional fields", () => {
    writeFileSync(
      path.join(tmpDir, "mcp-graph.config.json"),
      JSON.stringify({}),
    );

    const config = loadConfig(tmpDir);

    expect(config.port).toBe(3000);
    expect(config.dbPath).toBe(".mcp-graph");
    expect(config.basePath).toBeUndefined();
    expect(config.integrations.gitnexusPort).toBe(3737);
  });

  it("should handle malformed JSON gracefully and use defaults", () => {
    writeFileSync(
      path.join(tmpDir, "mcp-graph.config.json"),
      "{ invalid json",
    );

    const config = loadConfig(tmpDir);

    expect(config.port).toBe(3000);
  });
});
