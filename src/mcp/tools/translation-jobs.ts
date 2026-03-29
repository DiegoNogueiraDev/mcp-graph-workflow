/**
 * MCP Tool: translation_jobs
 * List, get, delete, and aggregate stats for translation jobs.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { TranslationStore } from "../../core/translation/translation-store.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";

export function registerTranslationJobs(server: McpServer, store: SqliteStore): void {
  let _cachedDb: unknown = null;
  let _translationStore: TranslationStore | null = null;

  function getTranslationStore(): TranslationStore {
    const db = store.getDb();
    if (db !== _cachedDb) {
      _cachedDb = db;
      _translationStore = new TranslationStore(db);
    }
    return _translationStore as TranslationStore;
  }

  server.tool(
    "translation_jobs",
    "Manage translation jobs: list, get, delete, or view aggregated stats.",
    {
      action: z.enum(["list", "get", "delete", "stats"]).describe("Action to perform"),
      jobId: z.string().optional().describe("Job ID (required for get/delete)"),
      status: z.string().optional().describe("Filter by status (for list action)"),
    },
    async ({ action, jobId, status }) => {
      logger.info("tool:translation_jobs", { action, jobId, status });

      try {
        const translationStore = getTranslationStore();
        const projectId = store.getProject()?.id;
        if (!projectId) {
          return mcpError("No active project. Use init or activate a project first.");
        }

        switch (action) {
          case "list": {
            let jobs = translationStore.listJobs(projectId);
            if (status) {
              jobs = jobs.filter((j) => j.status === status);
            }
            return mcpText({
              ok: true,
              jobs: jobs.map((j) => ({
                id: j.id,
                sourceLanguage: j.sourceLanguage,
                targetLanguage: j.targetLanguage,
                status: j.status,
                scope: j.scope,
                confidenceScore: j.confidenceScore ?? null,
                createdAt: j.createdAt,
              })),
            });
          }

          case "get": {
            if (!jobId) {
              return mcpError("jobId is required for get action");
            }
            const job = translationStore.getJob(jobId);
            if (!job) {
              return mcpError(`Job not found: ${jobId}`);
            }
            return mcpText({ ok: true, job });
          }

          case "delete": {
            if (!jobId) {
              return mcpError("jobId is required for delete action");
            }
            const deleted = translationStore.deleteJob(jobId);
            if (!deleted) {
              return mcpError(`Job not found: ${jobId}`);
            }
            return mcpText({ ok: true, deleted: true });
          }

          case "stats": {
            const jobs = translationStore.listJobs(projectId);
            const totalJobs = jobs.length;
            const done = jobs.filter((j) => j.status === "done").length;
            const failed = jobs.filter((j) => j.status === "failed").length;
            const pending = jobs.filter((j) => j.status === "pending").length;

            const jobsWithConfidence = jobs.filter((j) => j.confidenceScore != null);
            const avgConfidence = jobsWithConfidence.length > 0
              ? jobsWithConfidence.reduce((sum, j) => sum + (j.confidenceScore ?? 0), 0) / jobsWithConfidence.length
              : 0;

            return mcpText({
              ok: true,
              totalJobs,
              done,
              failed,
              pending,
              avgConfidence: Math.round(avgConfidence * 1000) / 1000,
            });
          }

          default:
            return mcpError(`Unknown action: ${action as string}`);
        }
      } catch (err) {
        logger.error("tool:translation_jobs:error", { error: err instanceof Error ? err.message : String(err) });
        return mcpError(err instanceof Error ? err : String(err));
      }
    },
  );
}
