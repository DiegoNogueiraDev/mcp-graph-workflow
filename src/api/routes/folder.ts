import { Router } from "express";
import { readdirSync, statSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { StoreManager } from "../../core/store/store-manager.js";
import { OpenFolderBodySchema } from "../../schemas/folder.schema.js";
import { validateBody } from "../middleware/validate.js";
import { STORE_DIR, LEGACY_STORE_DIR, DB_FILE } from "../../core/utils/constants.js";
import { CodeStore } from "../../core/code/code-store.js";
import { CodeIndexer } from "../../core/code/code-indexer.js";
import { logger } from "../../core/utils/logger.js";

/** Directories that should never be browsable (OS-level sensitive paths). */
const BLOCKED_PATHS = new Set(["/proc", "/sys", "/dev", "/boot", "/lost+found"]);

/**
 * Validate and resolve a browse path for the folder picker endpoint.
 * Rejects null bytes, blocked system directories, and non-absolute resolved paths.
 * Exported for testing.
 */
export function validateBrowsePath(rawPath: string): string {
  // Reject null byte injection
  if (rawPath.includes("\0")) {
    throw new Error("Path contains null bytes");
  }

  const resolved = path.resolve(rawPath);

  // Reject system-sensitive directories
  for (const blocked of BLOCKED_PATHS) {
    if (resolved === blocked || resolved.startsWith(blocked + path.sep)) {
      throw new Error(`Access denied: ${blocked} is a restricted system directory`);
    }
  }

  // Restrict browsing to home directory tree or system tmpdir
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const tmpDir = tmpdir();
  const allowed = [home, path.dirname(home), tmpDir].filter(Boolean);
  if (home && !allowed.some((a) => resolved === a || resolved.startsWith(a + path.sep))) {
    throw new Error("Access denied: browsing restricted to home directory");
  }

  return resolved;
}

export function createFolderRouter(storeManager: StoreManager): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({
      currentPath: storeManager.basePath,
      recentFolders: storeManager.recentFolders,
    });
  });

  router.post("/open", validateBody(OpenFolderBodySchema), async (req, res, next) => {
    try {
      const { path: folderPath } = req.body as { path: string };
      const result = storeManager.swap(folderPath);

      if (!result.ok) {
        res.status(400).json({ ok: false, error: result.error });
        return;
      }

      // Trigger code graph re-index for the new project (non-blocking)
      const newBasePath = result.basePath;
      try {
        const project = storeManager.store.getProject();
        if (project) {
          const codeStore = new CodeStore(storeManager.store.getDb());
          const indexer = new CodeIndexer(codeStore, project.id);
          const indexResult = await indexer.indexDirectory(newBasePath, newBasePath);
          logger.info("Code graph re-indexed after folder swap", {
            basePath: newBasePath,
            symbols: indexResult.symbolCount,
          });
        }
      } catch (err) {
        logger.warn("Code graph re-index after swap failed (non-blocking)", {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      res.json({
        ok: true,
        basePath: result.basePath,
        recentFolders: storeManager.recentFolders,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/browse", (req, res) => {
    const dirPath = req.query.path as string | undefined;

    if (!dirPath || dirPath.trim().length === 0) {
      res.status(400).json({ error: "Query parameter 'path' is required" });
      return;
    }

    // Security: validate and resolve path before any filesystem access
    let resolvedPath: string;
    try {
      resolvedPath = validateBrowsePath(dirPath);
    } catch (err) {
      res.status(403).json({ error: err instanceof Error ? err.message : "Invalid path" });
      return;
    }

    if (!existsSync(resolvedPath)) {
      res.status(400).json({ error: `Directory does not exist: ${resolvedPath}` });
      return;
    }

    try {
      const stat = statSync(resolvedPath);
      if (!stat.isDirectory()) {
        res.status(400).json({ error: `Not a directory: ${resolvedPath}` });
        return;
      }

      const rawEntries = readdirSync(resolvedPath, { withFileTypes: true });

      const entries = rawEntries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => {
          const fullPath = path.join(resolvedPath, entry.name);
          const hasNewStore = existsSync(path.join(fullPath, STORE_DIR, DB_FILE));
          const hasLegacyStore = existsSync(path.join(fullPath, LEGACY_STORE_DIR, DB_FILE));

          return {
            name: entry.name,
            path: fullPath,
            isDirectory: true,
            hasGraph: hasNewStore || hasLegacyStore,
          };
        })
        .sort((a, b) => {
          if (a.hasGraph !== b.hasGraph) return a.hasGraph ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      res.json({
        path: resolvedPath,
        parent: path.dirname(resolvedPath),
        entries,
      });
    } catch (err) {
      res.status(400).json({
        error: `Cannot read directory: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });

  return router;
}
