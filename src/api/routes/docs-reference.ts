/**
 * Docs Reference API — serves introspected tool/route catalogs and markdown docs.
 * Powers the Docs tab in the dashboard.
 */

import { Router } from "express";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { introspectTools } from "../../core/docs/tool-introspector.js";
import { introspectRoutes } from "../../core/docs/route-introspector.js";
import { logger } from "../../core/utils/logger.js";

// ── Cached introspection results ────────────────────

let _toolsCache: ReturnType<typeof introspectTools> | null = null;
let _routesCache: ReturnType<typeof introspectRoutes> | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

function getTools(basePath: string): ReturnType<typeof introspectTools> {
  if (_toolsCache && Date.now() - _cacheTimestamp < CACHE_TTL_MS) return _toolsCache;
  const toolsDir = path.join(basePath, "src", "mcp", "tools");
  _toolsCache = existsSync(toolsDir) ? introspectTools(toolsDir) : [];
  _cacheTimestamp = Date.now();
  return _toolsCache;
}

function getRoutes(basePath: string): ReturnType<typeof introspectRoutes> {
  if (_routesCache && Date.now() - _cacheTimestamp < CACHE_TTL_MS) return _routesCache;
  const apiDir = path.join(basePath, "src", "api");
  _routesCache = existsSync(apiDir) ? introspectRoutes(apiDir) : [];
  return _routesCache;
}

// ── Doc file discovery ──────────────────────────────

interface DocEntry {
  slug: string;
  title: string;
  category: string;
  path: string;
}

function discoverDocs(basePath: string): DocEntry[] {
  const docsDir = path.join(basePath, "docs");
  if (!existsSync(docsDir)) return [];

  const entries: DocEntry[] = [];
  const categories = readdirSync(docsDir).filter((d) => {
    const full = path.join(docsDir, d);
    return existsSync(full) && statSync(full).isDirectory();
  });

  for (const category of categories) {
    const catDir = path.join(docsDir, category);
    const files = readdirSync(catDir).filter((f) => f.endsWith(".md"));

    for (const file of files) {
      const slug = `${category}/${file.replace(/\.md$/, "")}`;
      const title = file
        .replace(/\.md$/, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      entries.push({ slug, title, category, path: path.join(catDir, file) });
    }
  }

  return entries;
}

// ── Router ──────────────────────────────────────────

export function createDocsReferenceRouter(getBasePath: () => string): Router {
  const router = Router();

  // GET /docs/tools — introspected tool catalog
  router.get("/tools", (_req, res, next) => {
    try {
      const tools = getTools(getBasePath());
      const active = tools.filter((t) => !t.deprecated);
      const deprecated = tools.filter((t) => t.deprecated);

      res.json({
        total: tools.length,
        active: active.length,
        deprecated: deprecated.length,
        tools,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /docs/routes — introspected route catalog
  router.get("/routes", (_req, res, next) => {
    try {
      const routes = getRoutes(getBasePath());
      const totalEndpoints = routes.reduce((sum, r) => sum + r.endpoints.length, 0);

      res.json({
        totalRouters: routes.length,
        totalEndpoints,
        routes,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /docs/stats — aggregated counts
  router.get("/stats", (_req, res, next) => {
    try {
      const basePath = getBasePath();
      const tools = getTools(basePath);
      const routes = getRoutes(basePath);
      const docs = discoverDocs(basePath);
      const totalEndpoints = routes.reduce((sum, r) => sum + r.endpoints.length, 0);

      res.json({
        tools: { active: tools.filter((t) => !t.deprecated).length, deprecated: tools.filter((t) => t.deprecated).length },
        routes: { routers: routes.length, endpoints: totalEndpoints },
        docs: docs.length,
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /docs — list available markdown docs
  router.get("/", (_req, res, next) => {
    try {
      const docs = discoverDocs(getBasePath());
      res.json({ docs });
    } catch (err) {
      next(err);
    }
  });

  // GET /docs/:category/:slug — read a specific markdown doc
  router.get("/:category/:slug", (req, res, next) => {
    try {
      const { category, slug } = req.params;
      const filePath = path.join(getBasePath(), "docs", category, `${slug}.md`);

      if (!existsSync(filePath)) {
        res.status(404).json({ error: `Doc not found: ${category}/${slug}` });
        return;
      }

      const content = readFileSync(filePath, "utf-8");
      logger.debug("docs:read", { category, slug });

      res.json({ slug: `${category}/${slug}`, content });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
