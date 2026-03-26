import { z } from "zod/v4";
import { readFileSync } from "node:fs";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { mergeGraph } from "../../core/importer/import-graph.js";
import type { GraphDocument } from "../../core/graph/graph-types.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";
import { indexEntitiesForSource } from "../../core/rag/entity-index-hook.js";
import { indexNodeAsKnowledge } from "../../core/rag/node-indexer.js";

export function registerImportGraph(server: McpServer, store: SqliteStore): void {
  server.tool(
    "import_graph",
    "Import and merge an exported graph JSON into the local graph without overriding existing data. " +
    "Nodes that already exist locally are kept (local wins). New nodes and edges are added. " +
    "Use dry_run=true to preview what would be merged. " +
    "Accepts either a JSON string (graph) or a file path (filePath) to the exported JSON.",
    {
      graph: z
        .string()
        .optional()
        .describe("JSON string of the exported GraphDocument (output of export action=json)"),
      filePath: z
        .string()
        .optional()
        .describe("Path to a JSON file containing the exported GraphDocument"),
      dry_run: z
        .boolean()
        .optional()
        .default(false)
        .describe("Preview merge without writing — returns counts of what would be inserted/skipped"),
    },
    async ({ graph, filePath, dry_run }) => {
      logger.info("tool:import_graph", { hasGraph: !!graph, filePath, dryRun: dry_run });

      // 1. Resolve input — either inline JSON or file path
      let jsonString: string;
      if (graph) {
        jsonString = graph;
      } else if (filePath) {
        try {
          jsonString = readFileSync(filePath, "utf-8");
        } catch (err) {
          return mcpError(`Failed to read file: ${filePath} — ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        return mcpError("Either 'graph' (JSON string) or 'filePath' (path to JSON file) must be provided.");
      }

      // 2. Parse JSON
      let parsed: GraphDocument;
      try {
        parsed = JSON.parse(jsonString) as GraphDocument;
      } catch {
        return mcpError("Invalid JSON: failed to parse the graph document.");
      }

      // 3. Capture existing node IDs before merge (to skip re-indexing)
      const existingNodeIds = new Set(
        (store.getDb().prepare("SELECT id FROM nodes").all() as Array<{ id: string }>)
          .map((r) => r.id),
      );

      // 4. Merge
      try {
        const result = mergeGraph(store, parsed, { dryRun: dry_run });

        // Index only newly inserted nodes into Knowledge Store + KG (skip on dry_run)
        if (!dry_run && result.nodesInserted > 0) {
          try {
            for (const node of parsed.nodes) {
              // Only index nodes that were actually inserted (not pre-existing)
              if (!existingNodeIds.has(node.id)) {
                indexNodeAsKnowledge(store.getDb(), node);
              }
            }
            indexEntitiesForSource(store.getDb(), "graph_node");
          } catch {
            logger.warn("import_graph:indexing-failed");
          }
        }

        logger.info("tool:import_graph:ok", {
          sourceProject: result.sourceProject,
          nodesInserted: result.nodesInserted,
          nodesSkipped: result.nodesSkipped,
          edgesInserted: result.edgesInserted,
          edgesSkipped: result.edgesSkipped,
          edgesOrphaned: result.edgesOrphaned,
          dryRun: dry_run,
        });

        return mcpText({
          ok: true,
          dryRun: dry_run,
          sourceProject: result.sourceProject,
          nodesInserted: result.nodesInserted,
          nodesSkipped: result.nodesSkipped,
          edgesInserted: result.edgesInserted,
          edgesSkipped: result.edgesSkipped,
          edgesOrphaned: result.edgesOrphaned,
          summary: dry_run
            ? `[DRY RUN] Would insert ${result.nodesInserted} nodes and ${result.edgesInserted} edges from "${result.sourceProject}". ${result.nodesSkipped} nodes and ${result.edgesSkipped} edges already exist locally.`
            : `Merged ${result.nodesInserted} nodes and ${result.edgesInserted} edges from "${result.sourceProject}". ${result.nodesSkipped} nodes and ${result.edgesSkipped} edges already existed locally (kept local version).`,
        });
      } catch (err) {
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}
