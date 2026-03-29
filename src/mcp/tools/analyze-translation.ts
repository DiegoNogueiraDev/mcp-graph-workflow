/**
 * MCP Tool: analyze_translation
 * Analyzes source code without creating a translation job — returns constructs, complexity, and confidence.
 */

import { z } from "zod/v4";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { TranslationOrchestrator } from "../../core/translation/translation-orchestrator.js";
import { TranslationStore } from "../../core/translation/translation-store.js";
import { ConstructRegistry } from "../../core/translation/ucr/construct-registry.js";
import { loadAndSeedRegistry } from "../../core/translation/ucr/construct-seed.js";
import { logger } from "../../core/utils/logger.js";
import { assertPathInsideProject } from "../../core/utils/fs.js";
import { CodeStore } from "../../core/code/code-store.js";
import { mcpText, mcpError } from "../response-helpers.js";

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  ".py": "python",
  ".ts": "typescript",
  ".js": "javascript",
  ".java": "java",
  ".go": "go",
  ".rs": "rust",
  ".cs": "csharp",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".scala": "scala",
  ".lua": "lua",
  ".hs": "haskell",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".c": "c",
  ".dart": "dart",
  ".ex": "elixir",
  ".exs": "elixir",
};

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
      const codeStore = new CodeStore(db);
      _orchestrator = new TranslationOrchestrator(registry, translationStore, codeStore);
    }
    return _orchestrator as TranslationOrchestrator;
  }

  server.tool(
    "analyze_translation",
    "Analyze source code for translation readiness. Returns detected language, constructs, complexity score, and estimated translatability without creating a job.",
    {
      code: z.string().optional().describe("Source code to analyze (alternative to filePath)"),
      filePath: z.string().optional().describe("Path to source file (alternative to code)"),
      sourceLanguage: z.string().optional().describe("Language hint (auto-detected if omitted)"),
      targetLanguage: z.string().optional().describe("Target language for translatability scoring"),
    },
    async ({ code, filePath, sourceLanguage, targetLanguage }) => {
      logger.info("tool:analyze_translation", { filePath, sourceLanguage, targetLanguage });

      try {
        let resolvedCode = code;
        let resolvedSourceLanguage = sourceLanguage;

        if (filePath) {
          const resolvedPath = assertPathInsideProject(filePath);
          resolvedCode = readFileSync(resolvedPath, "utf-8");
          if (!resolvedSourceLanguage) {
            const ext = path.extname(resolvedPath).toLowerCase();
            resolvedSourceLanguage = EXTENSION_TO_LANGUAGE[ext];
          }
        }

        if (!resolvedCode) {
          return mcpError("Either code or filePath is required");
        }

        const projectId = store.getProject()?.id;
        const analysis = getOrchestrator().analyzeSource(
          resolvedCode,
          { languageHint: resolvedSourceLanguage, targetLanguage },
          filePath ?? undefined,
          projectId ?? undefined,
        );

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
