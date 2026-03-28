/**
 * Batch SIF Importer — imports multiple SIF files from a directory with concurrency control.
 */

import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { parseSifFile } from "./sif-parser.js";
import { logger } from "../utils/logger.js";
import type { SiebelSifParseResult } from "../../schemas/siebel.schema.js";

export interface BatchImportOptions {
  concurrency?: number;
}

export interface BatchImportError {
  file: string;
  error: string;
}

export interface BatchImportResult {
  totalFiles: number;
  successCount: number;
  errorCount: number;
  totalObjects: number;
  totalDependencies: number;
  objectsByType: Record<string, number>;
  errors: BatchImportError[];
  results: SiebelSifParseResult[];
}

/**
 * Import all .sif files from a directory with concurrency control.
 * Non-SIF files are skipped. Errors are collected per-file without failing the batch.
 */
export async function batchImportSifs(
  dirPath: string,
  options?: BatchImportOptions,
): Promise<BatchImportResult> {
  const concurrency = options?.concurrency ?? 5;

  const entries = await readdir(dirPath, { withFileTypes: true });
  const sifFiles = entries
    .filter((e) => e.isFile() && extname(e.name).toLowerCase() === ".sif")
    .map((e) => e.name);

  const results: SiebelSifParseResult[] = [];
  const errors: BatchImportError[] = [];
  const objectsByType: Record<string, number> = {};
  let totalObjects = 0;
  let totalDependencies = 0;

  // Process in batches respecting concurrency limit
  for (let i = 0; i < sifFiles.length; i += concurrency) {
    const batch = sifFiles.slice(i, i + concurrency);
    const batchPromises = batch.map(async (fileName) => {
      const filePath = join(dirPath, fileName);
      try {
        const parseResult = await parseSifFile(filePath);
        return { fileName, parseResult, error: null };
      } catch (err) {
        return { fileName, parseResult: null, error: err instanceof Error ? err.message : String(err) };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const item of batchResults) {
      if (item.parseResult) {
        results.push(item.parseResult);
        totalObjects += item.parseResult.objects.length;
        totalDependencies += item.parseResult.dependencies.length;

        for (const obj of item.parseResult.objects) {
          objectsByType[obj.type] = (objectsByType[obj.type] ?? 0) + 1;
        }
      } else {
        errors.push({ file: item.fileName, error: item.error ?? "Unknown error" });
      }
    }
  }

  logger.info("Batch SIF import complete", {
    totalFiles: String(sifFiles.length),
    success: String(results.length),
    errors: String(errors.length),
    totalObjects: String(totalObjects),
  });

  return {
    totalFiles: sifFiles.length,
    successCount: results.length,
    errorCount: errors.length,
    totalObjects,
    totalDependencies,
    objectsByType,
    errors,
    results,
  };
}
