import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { unlink } from "node:fs/promises";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { readFileContent, isSupportedFormat } from "../../core/parser/file-reader.js";
import { extractEntities } from "../../core/parser/extract.js";
import { convertToGraph } from "../../core/importer/prd-to-graph.js";
import { logger } from "../../core/utils/logger.js";

const upload = multer({ dest: "/tmp/mcp-graph-uploads/" });

export function createImportRouter(store: SqliteStore): Router {
  const router = Router();

  router.post(
    "/",
    upload.single("file"),
    async (req, res, next) => {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "No file uploaded. Send a file with field name 'file'." });
        return;
      }

      if (!isSupportedFormat(file.originalname)) {
        await cleanupFile(file.path);
        res.status(400).json({
          error: `Unsupported file format. Supported: .md, .txt, .pdf, .html, .htm`,
        });
        return;
      }

      try {
        // Ensure project is initialized
        if (!store.getProject()) {
          store.initProject();
        }

        const force = req.body?.force === "true" || req.body?.force === true;
        const sourceFileName = file.originalname;

        // Check for previous import
        const alreadyImported = store.hasImport(sourceFileName);
        if (alreadyImported && !force) {
          await cleanupFile(file.path);
          res.status(409).json({
            error: `File "${sourceFileName}" was already imported. Set force=true to re-import.`,
            sourceFile: sourceFileName,
          });
          return;
        }

        // Clear previous import if force
        let cleared: { nodesDeleted: number; edgesDeleted: number } | null = null;
        if (alreadyImported && force) {
          cleared = store.clearImportedNodes(sourceFileName);
        }

        // Read file content
        const { text } = await readFileContent(file.path, file.originalname);

        // Extract entities
        const extraction = extractEntities(text);

        // Convert to graph
        const { nodes, edges, stats } = convertToGraph(extraction, sourceFileName);

        // Bulk insert
        store.bulkInsert(nodes, edges);

        // Record import + snapshot
        store.recordImport(sourceFileName, stats.nodesCreated, stats.edgesCreated);
        store.createSnapshot();

        logger.info("Import via API complete", {
          file: sourceFileName,
          nodes: stats.nodesCreated,
          edges: stats.edgesCreated,
        });

        res.status(201).json({
          ok: true,
          sourceFile: sourceFileName,
          ...stats,
          ...(cleared
            ? {
                reimported: true,
                previousNodesDeleted: cleared.nodesDeleted,
                previousEdgesDeleted: cleared.edgesDeleted,
              }
            : {}),
        });
      } catch (err) {
        next(err);
      } finally {
        await cleanupFile(file.path);
      }
    },
  );

  return router;
}

async function cleanupFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    // File may already be cleaned up
  }
}
