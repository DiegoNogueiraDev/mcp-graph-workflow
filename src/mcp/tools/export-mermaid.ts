import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { graphToMermaid } from "../../core/graph/mermaid-export.js";
import type { NodeStatus, NodeType } from "../../core/graph/graph-types.js";
import { z } from "zod/v4";

export function registerExportMermaid(server: McpServer, store: SqliteStore): void {
  server.tool(
    "export_mermaid",
    "Export the graph as a Mermaid diagram (flowchart or mindmap)",
    {
      format: z.enum(["flowchart", "mindmap"]).optional().describe("Diagram format (default: flowchart)"),
      direction: z.enum(["TD", "LR"]).optional().describe("Flow direction for flowchart (default: TD)"),
      filterStatus: z.array(z.enum(["backlog", "ready", "in_progress", "blocked", "done"])).optional().describe("Only include nodes with these statuses"),
      filterType: z.array(z.enum(["epic", "task", "subtask", "requirement", "constraint", "milestone", "acceptance_criteria", "risk", "decision"])).optional().describe("Only include nodes with these types"),
    },
    async (params) => {
      const doc = store.toGraphDocument();

      const mermaid = graphToMermaid(doc.nodes, doc.edges, {
        format: params.format as "flowchart" | "mindmap" | undefined,
        direction: params.direction as "TD" | "LR" | undefined,
        filterStatus: params.filterStatus as NodeStatus[] | undefined,
        filterType: params.filterType as NodeType[] | undefined,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: mermaid,
          },
        ],
      };
    },
  );
}
