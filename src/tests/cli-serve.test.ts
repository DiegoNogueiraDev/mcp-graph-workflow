import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { serveCommand } from "../cli/commands/serve.js";

describe("serveCommand", () => {
  const originalPort = process.env.MCP_PORT;

  afterEach(() => {
    if (originalPort !== undefined) {
      process.env.MCP_PORT = originalPort;
    } else {
      delete process.env.MCP_PORT;
    }
  });

  it("should return a Command with name 'serve'", () => {
    const cmd = serveCommand();

    expect(cmd.name()).toBe("serve");
    expect(cmd.description()).toContain("dashboard");
  });

  it("should have default port 3000", () => {
    const cmd = serveCommand();
    const portOption = cmd.opts();

    // Before parsing, opts returns defaults from option definition
    // The default is set via Commander option string "3000"
    expect(cmd.getOptionValue("port")).toBe("3000");
  });

  it("should set process.env.MCP_PORT on valid port", async () => {
    const cmd = serveCommand();

    // Mock the dynamic import to prevent actual server startup
    vi.doMock("../../mcp/server.js", () => ({}));

    // Parse with a valid port
    cmd.exitOverride(); // Prevent process.exit
    try {
      await cmd.parseAsync(["node", "serve", "--port", "4567"]);
    } catch {
      // Dynamic import may fail in test env, that's OK
    }

    expect(process.env.MCP_PORT).toBe("4567");
  });

  it("should reject invalid port with exit", async () => {
    const cmd = serveCommand();
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    cmd.exitOverride();

    // NaN port
    await expect(async () => {
      await cmd.parseAsync(["node", "serve", "--port", "abc"]);
    }).rejects.toThrow();

    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });
});
