/**
 * MCP Tool: siebel_analyze
 * Analyze Siebel object dependencies, impact, and circular references.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import {
  analyzeSiebelImpact,
  findDependencyChain,
  detectCircularDeps,
} from "../../core/siebel/dependency-analyzer.js";
import { parseSifContent } from "../../core/siebel/sif-parser.js";
import { SiebelObjectTypeSchema } from "../../schemas/siebel.schema.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerSiebelAnalyze(server: McpServer, store: SqliteStore): void {
  server.tool(
    "siebel_analyze",
    "Analyze Siebel object dependencies. Modes: impact (blast radius of changing an object), dependencies (find chain between two objects), circular (detect cycles), summary (overview of all Siebel objects in knowledge store).",
    {
      action: z.enum(["impact", "dependencies", "circular", "summary"]).describe("Analysis mode"),
      objectName: z.string().optional().describe("Siebel object name (for impact analysis)"),
      objectType: SiebelObjectTypeSchema.optional().describe("Siebel object type"),
      targetName: z.string().optional().describe("Target object for dependency chain"),
      targetType: SiebelObjectTypeSchema.optional().describe("Target object type"),
      sifContent: z.string().optional().describe("Raw SIF content to analyze (if not using stored data)"),
    },
    async ({ action, objectName, objectType, targetName, targetType, sifContent }) => {
      logger.info("tool:siebel_analyze", { action, objectName, objectType });

      try {
        // Get dependencies from SIF content or stored knowledge
        let dependencies;
        if (sifContent) {
          const parseResult = parseSifContent(sifContent, "analyze-input.sif");
          dependencies = parseResult.dependencies;
        } else {
          // Search knowledge store for Siebel SIF data
          const knowledgeStore = new KnowledgeStore(store.getDb());
          const docs = knowledgeStore.search("Siebel", 100);
          const siebelDocs = docs.filter((d) => d.sourceType === "siebel_sif");

          if (siebelDocs.length === 0) {
            return mcpError("No Siebel data found in knowledge store. Import a SIF file first with siebel_import_sif.");
          }

          // Extract dependencies from stored metadata
          // For now, require sifContent for detailed analysis
          if (action !== "summary") {
            return mcpError("Detailed analysis requires sifContent parameter. Use siebel_import_sif to import a SIF first, then pass the content here.");
          }

          return mcpText({
            ok: true,
            action: "summary",
            totalDocuments: siebelDocs.length,
            objectTypes: [...new Set(siebelDocs.map((d) => d.metadata?.siebelType).filter(Boolean))],
            projects: [...new Set(siebelDocs.map((d) => d.metadata?.siebelProject).filter(Boolean))],
          });
        }

        switch (action) {
          case "impact": {
            if (!objectName || !objectType) {
              return mcpError("objectName and objectType are required for impact analysis");
            }
            const impact = analyzeSiebelImpact(dependencies, { name: objectName, type: objectType });
            return mcpText({ ok: true, action: "impact", ...impact });
          }

          case "dependencies": {
            if (!objectName || !objectType || !targetName || !targetType) {
              return mcpError("objectName, objectType, targetName, and targetType are required for dependency chain analysis");
            }
            const chains = findDependencyChain(
              dependencies,
              { name: objectName, type: objectType },
              { name: targetName, type: targetType },
            );
            return mcpText({
              ok: true,
              action: "dependencies",
              from: { name: objectName, type: objectType },
              to: { name: targetName, type: targetType },
              pathsFound: chains.length,
              paths: chains,
            });
          }

          case "circular": {
            const cycles = detectCircularDeps(dependencies);
            return mcpText({
              ok: true,
              action: "circular",
              cyclesFound: cycles.length,
              cycles,
            });
          }

          case "summary": {
            if (!sifContent) {
              return mcpError("sifContent is required for summary analysis");
            }
            const parseResult = parseSifContent(sifContent, "summary-input.sif");
            return mcpText({
              ok: true,
              action: "summary",
              metadata: parseResult.metadata,
              objectCount: parseResult.objects.length,
              dependencyCount: parseResult.dependencies.length,
              objectsByType: Object.fromEntries(
                [...new Set(parseResult.objects.map((o) => o.type))].map((t) => [
                  t,
                  parseResult.objects.filter((o) => o.type === t).length,
                ]),
              ),
            });
          }

          default:
            return mcpError(`Unknown action: ${action}`);
        }
      } catch (err) {
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}
