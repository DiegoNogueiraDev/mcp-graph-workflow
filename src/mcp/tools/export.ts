import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { graphToMermaid, filterNodes } from "../../core/graph/mermaid-export.js";
import type { NodeStatus, NodeType } from "../../core/graph/graph-types.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText } from "../response-helpers.js";

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
      logger.debug("tool:export", { format: action });
      const doc = store.toGraphDocument();

      if (action === "json") {
        let filteredDoc = doc;
        if ((filterType && filterType.length > 0) || (filterStatus && filterStatus.length > 0)) {
          const filteredNodes = filterNodes(doc.nodes, {
            filterType: filterType as NodeType[] | undefined,
            filterStatus: filterStatus as NodeStatus[] | undefined,
          });
          const nodeIds = new Set(filteredNodes.map((n) => n.id));
          const filteredEdges = doc.edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to));
          // Bug #023: rebuild indexes to match filtered nodes/edges
          const filteredByIdIndex: Record<string, number> = {};
          filteredNodes.forEach((n, i) => { filteredByIdIndex[n.id] = i; });
          const filteredChildrenByParent: Record<string, string[]> = {};
          const filteredIncomingByNode: Record<string, string[]> = {};
          const filteredOutgoingByNode: Record<string, string[]> = {};
          for (const n of filteredNodes) {
            if (n.parentId && nodeIds.has(n.parentId)) {
              (filteredChildrenByParent[n.parentId] ??= []).push(n.id);
            }
          }
          for (const e of filteredEdges) {
            (filteredOutgoingByNode[e.from] ??= []).push(e.id);
            (filteredIncomingByNode[e.to] ??= []).push(e.id);
          }
          filteredDoc = {
            ...doc,
            nodes: filteredNodes,
            edges: filteredEdges,
            indexes: {
              byId: filteredByIdIndex,
              childrenByParent: filteredChildrenByParent,
              incomingByNode: filteredIncomingByNode,
              outgoingByNode: filteredOutgoingByNode,
            },
          };
        }
        logger.info("tool:export:ok", { format: "json", nodes: filteredDoc.nodes.length });
        return mcpText(filteredDoc);
      }

      // action === "mermaid"
      const mermaid = graphToMermaid(doc.nodes, doc.edges, {
        format: format as "flowchart" | "mindmap" | undefined,
        direction: direction as "TD" | "LR" | undefined,
        filterStatus: filterStatus as NodeStatus[] | undefined,
        filterType: filterType as NodeType[] | undefined,
      });

      logger.info("tool:export:ok", { format: "mermaid", diagramFormat: format ?? "flowchart" });
      return {
        content: [
          { type: "text" as const, text: mermaid },
        ],
      };
    },
  );
}
