/**
 * Shared MCP response formatters — single source of truth for tool responses.
 *
 * Replaces 55+ inline JSON.stringify response blocks and 19+ error blocks.
 */

export interface McpToolResponse {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/** Format a success response with pretty-printed JSON. */
export function mcpText(data: unknown): McpToolResponse {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/** Format an error response with isError flag. */
export function mcpError(error: Error | string): McpToolResponse {
  const message = error instanceof Error ? error.message : error;
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

/** Normalize escaped newlines from MCP clients (literal \\n → actual \n). */
export function normalizeNewlines(text: string | undefined): string | undefined {
  if (!text) return text;
  return text.replace(/\\n/g, "\n");
}
