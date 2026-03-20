import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { buildTaskContext } from "../../core/context/compact-context.js";
import { NodeNotFoundError } from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerContext(server: McpServer, store: SqliteStore): void {
  server.tool(
    "context",
    "Get a compact, AI-optimized context payload for a specific task (includes parent, children, blockers, dependencies, acceptance criteria, source references, and token reduction metrics)",
    { id: z.string().describe("The node ID to build context for") },
    async ({ id }) => {
      logger.debug("tool:context", { id });
      const ctx = buildTaskContext(store, id);

      if (!ctx) {
        const err = new NodeNotFoundError(id);
        logger.warn("tool:context:fail", { error: err.message });
        return mcpError(err);
      }

      logger.info("tool:context:ok", { id });
      return mcpText(ctx);
    },
  );
}
