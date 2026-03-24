/**
 * Code indexer — orchestrates: walk files → analyze → store.
 * Supports incremental reindexing by clearing per-file data before reinserting.
 */

import { readdirSync } from "node:fs";
import path from "node:path";
import type { CodeStore } from "./code-store.js";
import type { IndexResult } from "./code-types.js";
import { analyzeFile, isTypeScriptAvailable } from "./ts-analyzer.js";
import { now } from "../utils/time.js";
import { logger } from "../utils/logger.js";

const TS_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);
const IGNORED_DIRS = new Set(["node_modules", "dist", ".git", "coverage", ".next", ".nuxt"]);

export class CodeIndexer {
  constructor(
    private readonly store: CodeStore,
    private readonly projectId: string,
  ) {}

  /**
   * Index all TypeScript/JavaScript files in a directory tree.
   */
  async indexDirectory(dirPath: string, basePath: string): Promise<IndexResult> {
    const files = walkDirectory(dirPath);

    logger.info("code-indexer:start", {
      directory: dirPath,
      fileCount: files.length,
    });

    return this.indexFiles(files, basePath);
  }

  /**
   * Index specific files.
   */
  async indexFiles(filePaths: string[], basePath: string): Promise<IndexResult> {
    const typescriptAvailable = await isTypeScriptAvailable();

    if (!typescriptAvailable) {
      logger.warn("code-indexer:typescript-unavailable", {
        message: "typescript package not found — code indexing disabled. Install it: npm install -D typescript",
        fileCount: filePaths.length,
      });

      this.store.upsertIndexMeta({
        projectId: this.projectId,
        lastIndexed: now(),
        fileCount: 0,
        symbolCount: 0,
        relationCount: 0,
      });

      return { fileCount: 0, symbolCount: 0, relationCount: 0, typescriptAvailable: false };
    }

    let totalSymbols = 0;
    let totalRelations = 0;
    let fileCount = 0;

    for (const filePath of filePaths) {
      const ext = path.extname(filePath);
      if (!TS_EXTENSIONS.has(ext)) continue;

      try {
        const relativePath = path.relative(basePath, filePath);

        // Clear existing data for this file (incremental)
        this.store.deleteSymbolsByFile(relativePath, this.projectId);

        const result = await analyzeFile(filePath, basePath);

        if (result.symbols.length === 0) continue;

        // Insert symbols
        const symbolsWithProject = result.symbols.map((s) => ({
          ...s,
          projectId: this.projectId,
          modulePath: extractModulePath(s.file),
        }));

        const symCount = this.store.insertSymbolsBulk(symbolsWithProject);
        totalSymbols += symCount;

        // Insert relations — need to resolve symbol IDs
        if (result.relations.length > 0) {
          const resolvedRelations = resolveRelationIds(
            result.relations,
            result.symbols,
            this.store,
            this.projectId,
          );

          if (resolvedRelations.length > 0) {
            const relCount = this.store.insertRelationsBulk(resolvedRelations);
            totalRelations += relCount;
          }
        }

        fileCount++;
      } catch (err) {
        logger.warn("code-indexer:file-error", {
          file: filePath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Update metadata
    this.store.upsertIndexMeta({
      projectId: this.projectId,
      lastIndexed: now(),
      fileCount,
      symbolCount: totalSymbols,
      relationCount: totalRelations,
    });

    logger.info("code-indexer:done", {
      fileCount,
      symbolCount: totalSymbols,
      relationCount: totalRelations,
    });

    return { fileCount, symbolCount: totalSymbols, relationCount: totalRelations, typescriptAvailable: true };
  }
}

// ── Helpers ──────────────────────────────────────────

function walkDirectory(dir: string): string[] {
  const files: string[] = [];

  function recurse(currentDir: string): void {
    let entries;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        recurse(fullPath);
      } else if (entry.isFile() && TS_EXTENSIONS.has(path.extname(entry.name))) {
        // Skip test files and declaration files
        if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".d.ts") || entry.name.endsWith(".spec.ts")) {
          continue;
        }
        files.push(fullPath);
      }
    }
  }

  recurse(dir);
  return files;
}

function extractModulePath(file: string): string {
  const dir = path.dirname(file);
  if (dir === "." || dir === "") return "root";
  // Normalize: src/core/utils → core/utils
  return dir.replace(/^src\//, "");
}

interface PartialRelation {
  fromSymbol: string;
  toSymbol: string;
  type: string;
  file?: string | null;
  line?: number | null;
  metadata?: Record<string, unknown>;
}

/**
 * Resolve symbolic relation references (symbol names) to actual stored IDs.
 * For belongs_to/extends/implements, both symbols are in the same file.
 * For calls/imports, the target may be in another file.
 */
function resolveRelationIds(
  relations: PartialRelation[],
  fileSymbols: Array<{ name: string; file: string }>,
  store: CodeStore,
  projectId: string,
): Array<Omit<import("./code-types.js").CodeRelation, "id" | "indexedAt">> {
  const resolved: Array<Omit<import("./code-types.js").CodeRelation, "id" | "indexedAt">> = [];

  for (const rel of relations) {
    // Find source symbol ID
    const fromCandidates = store.findSymbolsByName(rel.fromSymbol, projectId);
    // For file-level imports, fromSymbol is the file path
    const from = fromCandidates.length > 0
      ? fromCandidates[0]
      : null;

    // Find target symbol ID
    const toCandidates = store.findSymbolsByName(rel.toSymbol, projectId);
    const to = toCandidates.length > 0
      ? toCandidates[0]
      : null;

    if (from && to) {
      resolved.push({
        projectId,
        fromSymbol: from.id,
        toSymbol: to.id,
        type: rel.type as "calls" | "imports" | "extends" | "implements" | "belongs_to",
        file: rel.file,
        line: rel.line,
        metadata: rel.metadata,
      });
    }
  }

  return resolved;
}
