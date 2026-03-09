import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { buildMcpServersConfig, MCP_SERVER_NAMES } from "../core/integrations/mcp-servers-config.js";

describe("mcp-servers-config", () => {
  // ── buildMcpServersConfig ─────────────────────────

  describe("buildMcpServersConfig", () => {
    it("should return config with all 5 MCP server entries", () => {
      const config = buildMcpServersConfig();
      const servers = config.mcpServers;

      expect(Object.keys(servers)).toHaveLength(5);
      expect(servers).toHaveProperty("mcp-graph");
      expect(servers).toHaveProperty("gitnexus");
      expect(servers).toHaveProperty("serena");
      expect(servers).toHaveProperty("context7");
      expect(servers).toHaveProperty("playwright");
    });

    it("should have correct mcp-graph server config", () => {
      const config = buildMcpServersConfig();
      const mcpGraph = config.mcpServers["mcp-graph"];

      expect(mcpGraph.command).toBe("npx");
      expect(mcpGraph.args).toContain("-y");
    });

    it("should have correct gitnexus server config with mcp arg", () => {
      const config = buildMcpServersConfig();
      const gitnexus = config.mcpServers["gitnexus"];

      expect(gitnexus.command).toBe("npx");
      expect(gitnexus.args).toContain("gitnexus");
      expect(gitnexus.args).toContain("mcp");
    });

    it("should have correct serena server config with uvx and --project", () => {
      const config = buildMcpServersConfig();
      const serena = config.mcpServers["serena"];

      expect(serena.command).toBe("uvx");
      expect(serena.args).toContain("serena");
      expect(serena.args).toContain("start-mcp-server");
      expect(serena.args).toContain("--project");
    });

    it("should have correct context7 server config", () => {
      const config = buildMcpServersConfig();
      const context7 = config.mcpServers["context7"];

      expect(context7.command).toBe("npx");
      expect(context7.args).toContain("@upstash/context7-mcp");
    });

    it("should have correct playwright server config", () => {
      const config = buildMcpServersConfig();
      const playwright = config.mcpServers["playwright"];

      expect(playwright.command).toBe("npx");
      expect(playwright.args).toContain("@playwright/mcp@latest");
    });

    it("should export MCP_SERVER_NAMES constant with all names", () => {
      expect(MCP_SERVER_NAMES).toContain("mcp-graph");
      expect(MCP_SERVER_NAMES).toContain("gitnexus");
      expect(MCP_SERVER_NAMES).toContain("serena");
      expect(MCP_SERVER_NAMES).toContain("context7");
      expect(MCP_SERVER_NAMES).toContain("playwright");
    });
  });

  // ── Merge with existing config ────────────────────

  describe("merge behavior", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = path.join(tmpdir(), `mcp-config-test-${Date.now()}`);
      mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("should preserve existing custom servers when merging", () => {
      const existing = {
        mcpServers: {
          "custom-server": { command: "node", args: ["custom.js"] },
        },
      };

      const config = buildMcpServersConfig(existing);

      expect(config.mcpServers["custom-server"]).toEqual({
        command: "node",
        args: ["custom.js"],
      });
      // All 5 standard servers should still be there
      expect(Object.keys(config.mcpServers).length).toBeGreaterThanOrEqual(6);
    });

    it("should override existing mcp-graph entry with latest config", () => {
      const existing = {
        mcpServers: {
          "mcp-graph": { command: "old-command", args: ["old"] },
        },
      };

      const config = buildMcpServersConfig(existing);

      expect(config.mcpServers["mcp-graph"].command).not.toBe("old-command");
    });
  });
});
