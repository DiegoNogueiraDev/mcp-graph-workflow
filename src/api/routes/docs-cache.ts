import { Router } from "express";
import type { StoreRef } from "../../core/store/store-manager.js";
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

export function createDocsCacheRouter(storeRef: StoreRef): Router {
  const router = Router();

  /** Lazy cache store — re-creates when the underlying DB changes. */
  let _cachedDb: unknown = null;
  let _cacheStore: DocsCacheStore | null = null;
  function getCacheStore(): DocsCacheStore {
    const db = storeRef.current.getDb();
    if (db !== _cachedDb) {
      _cachedDb = db;
      _cacheStore = new DocsCacheStore(db);
    }
    return _cacheStore!;
  }

  router.get("/", (req, res, next) => {
    try {
      const cacheStore = getCacheStore();
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
      const cacheStore = getCacheStore();
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
      const cacheStore = getCacheStore();
      const { lib } = req.body as { lib?: string };
      if (!lib) {
        res.status(400).json({ error: "Missing 'lib' in request body" });
        return;
      }

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
