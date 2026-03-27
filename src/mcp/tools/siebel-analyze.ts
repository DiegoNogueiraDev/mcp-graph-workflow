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
import { diffSifObjects, formatDiffMarkdown } from "../../core/siebel/sif-diff.js";
import { SiebelObjectTypeSchema } from "../../schemas/siebel.schema.js";
import { KnowledgeStore } from "../../core/store/knowledge-store.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError, normalizeNewlines } from "../response-helpers.js";

export function registerSiebelAnalyze(server: McpServer, store: SqliteStore): void {
  server.tool(
    "siebel_analyze",
    "Analyze Siebel objects. Modes: impact, dependencies, circular, summary, diff (structural comparison of two SIFs).",
    {
      action: z.enum(["impact", "dependencies", "circular", "summary", "diff"]).describe("Analysis mode"),
      objectName: z.string().optional().describe("Siebel object name (for impact analysis)"),
      objectType: SiebelObjectTypeSchema.optional().describe("Siebel object type"),
      targetName: z.string().optional().describe("Target object for dependency chain"),
      targetType: SiebelObjectTypeSchema.optional().describe("Target object type"),
      sifContent: z.string().optional().describe("Raw SIF content (base for diff, or input for other modes)"),
      targetSifContent: z.string().optional().describe("Target SIF content (for diff mode)"),
      outputFormat: z.enum(["json", "markdown"]).optional().default("json").describe("Output format for diff"),
    },
    async ({ action, objectName, objectType, targetName, targetType, sifContent, targetSifContent, outputFormat }) => {
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
          if (action !== "summary" && action !== "diff") {
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

          case "diff": {
            if (!sifContent || !targetSifContent) {
              return mcpError("sifContent and targetSifContent are required for diff mode");
            }
            const baseNorm = normalizeNewlines(sifContent) ?? sifContent;
            const targetNorm = normalizeNewlines(targetSifContent) ?? targetSifContent;
            const baseResult = parseSifContent(baseNorm, "base.sif");
            const targetResult = parseSifContent(targetNorm, "target.sif");
            const diffResult = diffSifObjects(baseResult.objects, targetResult.objects);

            if (outputFormat === "markdown") {
              const markdown = formatDiffMarkdown(diffResult);
              return mcpText({ ok: true, action: "diff", format: "markdown", content: markdown });
            }

            return mcpText({ ok: true, action: "diff", format: "json", ...diffResult });
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
