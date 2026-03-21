/**
 * MCP Tool: siebel_validate
 * Validate Siebel .SIF file integrity, dependencies, and version compatibility.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { parseSifFile, parseSifContent } from "../../core/siebel/sif-parser.js";
import { detectCircularDeps } from "../../core/siebel/dependency-analyzer.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError, normalizeNewlines } from "../response-helpers.js";
import type { SiebelObject, SiebelSifParseResult } from "../../schemas/siebel.schema.js";

export function registerSiebelValidate(server: McpServer, _store: SqliteStore): void {
  server.tool(
    "siebel_validate",
    "Validate a Siebel .SIF file for integrity, missing dependencies, circular references, and best practices.",
    {
      filePath: z.string().optional().describe("Path to the .sif file"),
      content: z.string().optional().describe("Raw SIF XML content"),
      fileName: z.string().optional().default("validate.sif").describe("File name for content mode"),
      checkDeps: z.boolean().optional().default(true).describe("Check for missing dependencies"),
      checkCircular: z.boolean().optional().default(true).describe("Check for circular dependencies"),
    },
    async ({ filePath, content, fileName, checkDeps, checkCircular }) => {
      logger.info("tool:siebel_validate", { filePath, fileName });

      try {
        let parseResult: SiebelSifParseResult;
        if (filePath) {
          parseResult = await parseSifFile(filePath);
        } else if (content) {
          const normalized = normalizeNewlines(content) ?? content;
          parseResult = parseSifContent(normalized, fileName);
        } else {
          return mcpError("Either filePath or content is required");
        }

        const errors: string[] = [];
        const warnings: string[] = [];
        const info: string[] = [];

        // Basic structure validation
        info.push(`Parsed ${parseResult.objects.length} objects, ${parseResult.dependencies.length} dependencies`);

        // Check for objects without names
        const unnamed = parseResult.objects.filter((o) => !o.name || o.name.trim() === "");
        if (unnamed.length > 0) {
          errors.push(`${unnamed.length} objects found without names`);
        }

        // Check for inactive objects
        const inactive = parseResult.objects.filter((o) => o.inactive);
        if (inactive.length > 0) {
          warnings.push(`${inactive.length} inactive objects: ${inactive.map((o) => o.name).join(", ")}`);
        }

        // Check dependencies
        if (checkDeps) {
          const objectIndex = new Set(
            parseResult.objects.map((o) => `${o.type}:${o.name}`),
          );

          const missingDeps = parseResult.dependencies.filter(
            (d) => !objectIndex.has(`${d.to.type}:${d.to.name}`),
          );

          if (missingDeps.length > 0) {
            for (const dep of missingDeps) {
              warnings.push(`Missing dependency: ${dep.from.name} → ${dep.to.type}:${dep.to.name}`);
            }
          }

          // Check for BCs without tables
          const bcsWithoutTable = parseResult.objects
            .filter((o) => o.type === "business_component")
            .filter((o) => !o.properties.some((p) => p.name === "TABLE"));
          if (bcsWithoutTable.length > 0) {
            warnings.push(`BCs without TABLE: ${bcsWithoutTable.map((o) => o.name).join(", ")}`);
          }
        }

        // Check circular dependencies
        if (checkCircular) {
          const cycles = detectCircularDeps(parseResult.dependencies);
          if (cycles.length > 0) {
            for (const cycle of cycles) {
              errors.push(`Circular dependency: ${cycle.cycle.map((r) => r.name).join(" → ")}`);
            }
          }
        }

        // Best practices
        validateBestPractices(parseResult.objects, warnings);

        const status = errors.length > 0 ? "invalid" : warnings.length > 0 ? "warnings" : "valid";

        return mcpText({
          ok: true,
          status,
          fileName: parseResult.metadata.fileName,
          objectCount: parseResult.objects.length,
          dependencyCount: parseResult.dependencies.length,
          errors,
          warnings,
          info,
        });
      } catch (err) {
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}

function validateBestPractices(objects: SiebelObject[], warnings: string[]): void {
  // Check for applets without BUS_COMP
  const appletsWithoutBc = objects
    .filter((o) => o.type === "applet")
    .filter((o) => !o.properties.some((p) => p.name === "BUS_COMP"));
  if (appletsWithoutBc.length > 0) {
    warnings.push(`Applets without BUS_COMP: ${appletsWithoutBc.map((o) => o.name).join(", ")}`);
  }

  // Check for views without BUS_OBJECT
  const viewsWithoutBo = objects
    .filter((o) => o.type === "view")
    .filter((o) => !o.properties.some((p) => p.name === "BUS_OBJECT"));
  if (viewsWithoutBo.length > 0) {
    warnings.push(`Views without BUS_OBJECT: ${viewsWithoutBo.map((o) => o.name).join(", ")}`);
  }
}
