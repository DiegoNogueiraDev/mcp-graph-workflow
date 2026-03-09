import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { graphToMermaid } from "../../core/graph/mermaid-export.js";
import type { NodeStatus, NodeType } from "../../core/graph/graph-types.js";

export function registerExport(server: McpServer, store: SqliteStore): void {
  server.tool(
    "export",
    "Export the graph as JSON or Mermaid diagram",
    {
      action: z.enum(["json", "mermaid"]).describe("Export format"),
      // mermaid params
      format: z.enum(["flowchart", "mindmap"]).optional().describe("Mermaid diagram format (default: flowchart)"),
      direction: z.enum(["TD", "LR"]).optional().describe("Flow direction for flowchart (default: TD)"),
      filterStatus: z.array(z.enum(["backlog", "ready", "in_progress", "blocked", "done"])).optional().describe("Only include nodes with these statuses"),
      filterType: z.array(z.enum(["epic", "task", "subtask", "requirement", "constraint", "milestone", "acceptance_criteria", "risk", "decision"])).optional().describe("Only include nodes with these types"),
    },
    async ({ action, format, direction, filterStatus, filterType }) => {
      const doc = store.toGraphDocument();

      if (action === "json") {
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(doc, null, 2) },
          ],
        };
      }

      // action === "mermaid"
      const mermaid = graphToMermaid(doc.nodes, doc.edges, {
        format: format as "flowchart" | "mindmap" | undefined,
        direction: direction as "TD" | "LR" | undefined,
        filterStatus: filterStatus as NodeStatus[] | undefined,
        filterType: filterType as NodeType[] | undefined,
      });

      return {
        content: [
          { type: "text" as const, text: mermaid },
        ],
      };
    },
  );
}
