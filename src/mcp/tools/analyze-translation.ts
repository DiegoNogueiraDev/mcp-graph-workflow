/**
 * MCP Tool: analyze_translation
 * Analyzes source code without creating a translation job — returns constructs, complexity, and confidence.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { TranslationOrchestrator } from "../../core/translation/translation-orchestrator.js";
import { TranslationStore } from "../../core/translation/translation-store.js";
import { ConstructRegistry } from "../../core/translation/ucr/construct-registry.js";
import { loadAndSeedRegistry } from "../../core/translation/ucr/construct-seed.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerAnalyzeTranslation(server: McpServer, store: SqliteStore): void {
  let _cachedDb: unknown = null;
  let _orchestrator: TranslationOrchestrator | null = null;

  function getOrchestrator(): TranslationOrchestrator {
    const db = store.getDb();
    if (db !== _cachedDb) {
      _cachedDb = db;
      const registry = new ConstructRegistry(db);
      loadAndSeedRegistry(registry);
      const translationStore = new TranslationStore(db);
      _orchestrator = new TranslationOrchestrator(registry, translationStore);
    }
    return _orchestrator as TranslationOrchestrator;
  }

  server.tool(
    "analyze_translation",
    "Analyze source code for translation readiness. Returns detected language, constructs, complexity score, and estimated translatability without creating a job.",
    {
      code: z.string().min(1).describe("Source code to analyze"),
      sourceLanguage: z.string().optional().describe("Language hint (auto-detected if omitted)"),
      targetLanguage: z.string().optional().describe("Target language for translatability scoring"),
    },
    async ({ code, sourceLanguage, targetLanguage }) => {
      logger.info("tool:analyze_translation", { sourceLanguage, targetLanguage });

      try {
        const analysis = getOrchestrator().analyzeSource(code, {
          languageHint: sourceLanguage,
          targetLanguage,
        });

        return mcpText({
          ok: true,
          detectedLanguage: analysis.detectedLanguage,
          detectedConfidence: analysis.detectedConfidence,
          constructs: analysis.constructs,
          complexityScore: analysis.complexityScore,
          estimatedTranslatability: analysis.estimatedTranslatability,
          ambiguousConstructs: analysis.ambiguousConstructs,
          totalConstructs: analysis.totalConstructs,
        });
      } catch (err) {
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}
