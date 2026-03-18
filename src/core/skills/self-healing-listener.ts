/**
 * Self-Healing Listener — creates auto-memories when errors are detected.
 * Subscribes to "error:detected" events on the GraphEventBus.
 * Deduplicates via error hash to prevent flood.
 */

import { createHash } from "node:crypto";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { GraphEventBus } from "../events/event-bus.js";
import type { GraphEvent } from "../events/event-types.js";
import { logger } from "../utils/logger.js";

export interface SelfHealingOptions {
  memoriesDir: string;
  eventBus: GraphEventBus;
}

/** Categorize an error message into a healing category. */
export function categorizeError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("type") && (lower.includes("error") || lower.includes("mismatch"))) return "type-error";
  if (lower.includes("validation") || lower.includes("invalid") || lower.includes("zod")) return "validation-error";
  if (lower.includes("build") || lower.includes("compile") || lower.includes("tsc")) return "build-error";
  if (lower.includes("test") && (lower.includes("fail") || lower.includes("assert"))) return "test-failure";
  if (lower.includes("sqlite") || lower.includes("database") || lower.includes("migration")) return "database-error";
  if (lower.includes("import") || lower.includes("module") || lower.includes("require")) return "module-error";
  return "general-error";
}

/** Generate a short hash for deduplication of error patterns. */
export function generateErrorHash(category: string, message: string): string {
  // Normalize: strip dynamic parts like timestamps, line numbers, ids
  const normalized = message
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.Z]+/g, "")
    .replace(/\b[a-f0-9]{12,}\b/g, "")
    .replace(/line \d+/gi, "line N")
    .replace(/:\d+:\d+/g, ":N:N")
    .trim();

  return createHash("sha256")
    .update(`${category}:${normalized}`)
    .digest("hex")
    .slice(0, 12);
}

/** Build the healing memory content. */
export function buildHealingMemory(
  category: string,
  errorMessage: string,
  toolName: string,
): string {
  const timestamp = new Date().toISOString();
  return [
    `# Self-Healing: ${category}`,
    "",
    "## Error Pattern",
    errorMessage,
    "",
    "## Prevention Rule",
    `When encountering similar ${category} issues, check the tool '${toolName}' inputs and outputs carefully.`,
    "Apply validation at boundaries and verify types match expected schemas before proceeding.",
    "",
    "## Context",
    `- Tool: ${toolName}`,
    `- Category: ${category}`,
    `- Date: ${timestamp}`,
  ].join("\n");
}

/**
 * Register the self-healing listener on the event bus.
 * Returns an unsubscribe function.
 */
export function registerSelfHealingListener(options: SelfHealingOptions): () => void {
  const { memoriesDir, eventBus } = options;

  // Ensure memories directory exists
  if (!existsSync(memoriesDir)) {
    mkdirSync(memoriesDir, { recursive: true });
  }

  const handler = (event: GraphEvent): void => {
    if (event.type !== "error:detected") return;

    const { toolName, errorMessage, errorCategory, errorHash } = event.payload as {
      toolName: string;
      errorMessage: string;
      errorCategory: string;
      errorHash: string;
    };

    const memoryName = `healing-${errorCategory}-${errorHash}`;
    const memoryPath = path.join(memoriesDir, `${memoryName}.md`);

    // Deduplication: skip if memory already exists
    if (existsSync(memoryPath)) {
      logger.debug("self-healing:skip-duplicate", { memoryName });
      return;
    }

    // Create healing memory
    const content = buildHealingMemory(errorCategory, errorMessage, toolName);
    try {
      writeFileSync(memoryPath, content, "utf-8");
      logger.info("self-healing:memory-created", { memoryName, category: errorCategory });

      // Emit healing event
      eventBus.emitTyped("healing:memory_created", {
        memoryName,
        errorCategory,
        errorHash,
      });
    } catch (err) {
      logger.error("self-healing:write-failed", { memoryName, error: String(err) });
    }
  };

  eventBus.on("error:detected", handler);

  return () => {
    eventBus.off("error:detected", handler);
  };
}
