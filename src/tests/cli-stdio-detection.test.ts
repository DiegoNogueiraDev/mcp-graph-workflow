import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";

const CLI_PATH = path.resolve("dist/cli/index.js");

describe("CLI stdio detection", () => {
  it("should show CLI help when called with --help (interactive mode)", () => {
    // Arrange & Act: call CLI with --help flag
    const output = execFileSync("node", [CLI_PATH, "--help"], {
      encoding: "utf-8",
      timeout: 10_000,
    });

    // Assert: should show Commander.js help output
    expect(output).toContain("mcp-graph");
    expect(output).toContain("Usage:");
  });

  it("should start MCP stdio server when called by an MCP client (piped stdin, no args)", async () => {
    // Arrange: use MCP SDK client to connect via stdio — this simulates a real MCP client
    const transport = new StdioClientTransport({
      command: "node",
      args: [CLI_PATH],
    });

    const client = new Client({ name: "test-client", version: "1.0.0" });

    // Act: connect and request tools
    await client.connect(transport);
    const serverVersion = client.getServerVersion();
    const tools = await client.listTools();

    // Assert: should respond as MCP server with all tools
    expect(serverVersion?.name).toBe("mcp-graph");
    expect(tools.tools.length).toBeGreaterThan(0);

    await client.close();
  }, 15_000);

  it("should run CLI normally when called with a subcommand (not MCP mode)", () => {
    // Arrange & Act: call CLI with 'stats' — should attempt CLI behavior, not stdio
    try {
      execFileSync("node", [CLI_PATH, "stats"], {
        encoding: "utf-8",
        timeout: 10_000,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string };
      // Assert: should NOT respond as MCP server
      const combined = (error.stdout ?? "") + (error.stderr ?? "");
      expect(combined).not.toContain('"serverInfo"');
    }
  });
});
