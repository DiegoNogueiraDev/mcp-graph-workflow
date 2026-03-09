import { Router } from "express";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { DocsCacheStore } from "../../core/docs/docs-cache-store.js";
import { DocsSyncer, type Context7Fetcher } from "../../core/docs/docs-syncer.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

function getFreshness(fetchedAt: string): "fresh" | "aging" | "stale" {
  const age = Date.now() - new Date(fetchedAt).getTime();
  if (age < ONE_DAY_MS) return "fresh";
  if (age < SEVEN_DAYS_MS) return "aging";
  return "stale";
}

export function createDocsCacheRouter(store: SqliteStore): Router {
  const router = Router();
  const cacheStore = new DocsCacheStore(store.getDb());

  router.get("/", (req, res, next) => {
    try {
      const lib = req.query.lib as string | undefined;

      if (lib) {
        const results = cacheStore.searchDocs(lib);
        res.json(
          results.map((d) => ({
            ...d,
            freshness: getFreshness(d.fetchedAt),
          })),
        );
        return;
      }

      const docs = cacheStore.listCached();
      res.json(
        docs.map((d) => ({
          ...d,
          freshness: getFreshness(d.fetchedAt),
        })),
      );
    } catch (err) {
      next(err);
    }
  });

  router.get("/:libId", (req, res, next) => {
    try {
      const doc = cacheStore.getDoc(req.params.libId);
      if (!doc) {
        res.status(404).json({ error: `Doc not found: ${req.params.libId}` });
        return;
      }
      res.json({ ...doc, freshness: getFreshness(doc.fetchedAt) });
    } catch (err) {
      next(err);
    }
  });

  router.post("/sync", async (req, res, next) => {
    try {
      const { lib } = req.body as { lib?: string };
      if (!lib) {
        res.status(400).json({ error: "Missing 'lib' in request body" });
        return;
      }

      // Create a no-op fetcher that returns a placeholder — real Context7 integration
      // requires MCP client connection which is not available in the REST API context.
      // The sync endpoint stores the lib name for future MCP-based sync.
      const placeholderFetcher: Context7Fetcher = {
        async resolveLibraryId(name: string): Promise<string> {
          return `context7:${name}`;
        },
        async queryDocs(): Promise<string> {
          return `Documentation placeholder for ${lib}. Use Context7 MCP tools for full sync.`;
        },
      };

      const syncer = new DocsSyncer(cacheStore, placeholderFetcher);
      const doc = await syncer.syncLib(lib);
      res.status(201).json({ ...doc, freshness: getFreshness(doc.fetchedAt) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
