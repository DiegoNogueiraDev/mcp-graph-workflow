/**
 * Centralized MCP server configuration for all ecosystem tools.
 * Generates the complete .mcp.json config with all integrated servers.
 */

export const MCP_SERVER_NAMES = [
  "mcp-graph",
  "context7",
  "playwright",
] as const;

export type McpServerName = (typeof MCP_SERVER_NAMES)[number];

export interface McpServerEntry {
  command: string;
  args: string[];
  type?: string;
}

export interface McpServersConfig {
  mcpServers: Record<string, McpServerEntry>;
}

function getDefaultServers(): Record<McpServerName, McpServerEntry> {
  return {
    "mcp-graph": {
      command: "npx",
      args: ["-y", "@mcp-graph-workflow/mcp-graph"],
    },
    context7: {
      command: "npx",
      args: ["-y", "@upstash/context7-mcp"],
    },
    playwright: {
      command: "npx",
      args: ["@playwright/mcp@latest"],
    },
  };
}

/**
 * Build complete MCP servers config, optionally merging with existing config.
 * Standard servers always override existing entries with the same name.
 * Custom servers (not in MCP_SERVER_NAMES) are preserved.
 */
export function buildMcpServersConfig(
  existing?: Partial<McpServersConfig>,
): McpServersConfig {
  const existingServers = (existing?.mcpServers ?? {}) as Record<string, McpServerEntry>;
  const defaultServers = getDefaultServers();

  return {
    mcpServers: {
      ...existingServers,
      ...defaultServers,
    },
  };
}
