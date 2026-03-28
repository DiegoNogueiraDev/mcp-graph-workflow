/**
 * MCP Tool: translate_code
 * Orchestrates the full translation workflow: analyze → prepare (with prompt) → finalize.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { TranslationStore } from "../../core/translation/translation-store.js";
import { TranslationOrchestrator } from "../../core/translation/translation-orchestrator.js";
import { ConstructRegistry } from "../../core/translation/ucr/construct-registry.js";
import { loadAndSeedRegistry } from "../../core/translation/ucr/construct-seed.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerTranslateCode(server: McpServer, store: SqliteStore): void {
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
    return _orchestrator!;
  }

  server.tool(
    "translate_code",
    "Translate code between programming languages. Creates a translation job, analyzes constructs, and returns a prompt for AI code generation. Call with generatedCode to finalize.",
    {
      code: z.string().min(1).describe("Source code to translate"),
      sourceLanguage: z.string().optional().describe("Source language hint (auto-detected if omitted)"),
      targetLanguage: z.string().min(1).describe("Target programming language"),
      scope: z.enum(["snippet", "function", "module"]).optional().default("snippet").describe("Translation scope"),
      generatedCode: z.string().optional().describe("AI-generated code to finalize (omit for analyze-only phase)"),
      jobId: z.string().optional().describe("Existing job ID to finalize (use with generatedCode)"),
    },
    async ({ code, sourceLanguage, targetLanguage, scope, generatedCode, jobId }) => {
      logger.info("tool:translate_code", { targetLanguage, scope, hasGeneratedCode: !!generatedCode, jobId });

      try {
        const orchestrator = getOrchestrator();

        // Finalize mode: submit generated code for an existing job
        if (jobId && generatedCode) {
          const result = orchestrator.finalizeTranslation(jobId, generatedCode);
          return mcpText({
            ok: true,
            phase: "finalized",
            jobId,
            confidence: result.evidence?.confidenceScore,
            risks: result.evidence?.risks,
            humanReviewPoints: result.evidence?.humanReviewPoints,
            translatedConstructs: result.evidence?.translatedConstructs,
          });
        }

        // Prepare mode: analyze + create job + return prompt
        const projectId = store.getProject()?.id ?? "default";
        const prepareResult = orchestrator.prepareTranslation({
          projectId,
          sourceCode: code,
          sourceLanguage,
          targetLanguage,
          scope,
        });

        return mcpText({
          ok: true,
          phase: "prepared",
          jobId: prepareResult.jobId,
          analysis: prepareResult.analysis,
          prompt: prepareResult.prompt,
          hint: "Use the prompt above to generate code with AI, then call translate_code again with jobId and generatedCode to finalize.",
        });
      } catch (err) {
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}
