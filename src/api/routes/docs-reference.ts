/**
 * Docs Reference API — serves introspected tool/route catalogs and markdown docs.
 * Powers the Docs tab in the dashboard.
 *
 * In dev mode (source files present), introspects live from filesystem.
 * In npm-installed mode, falls back to a pre-computed docs-manifest.json.
 */

import { Router } from "express";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { introspectTools } from "../../core/docs/tool-introspector.js";
import { introspectRoutes } from "../../core/docs/route-introspector.js";
import { logger } from "../../core/utils/logger.js";
import type { ToolInfo } from "../../core/docs/tool-introspector.js";
import type { RouteInfo } from "../../core/docs/route-introspector.js";

// ── Manifest types ─────────────────────────────────

interface DocsManifest {
  generatedAt: string;
  tools: ToolInfo[];
  routes: RouteInfo[];
  docs: Array<{ slug: string; title: string; category: string; content: string }>;
}

// ── Manifest loader (npm-installed fallback) ───────

let _manifest: DocsManifest | null | undefined; // undefined = not loaded yet

function loadManifest(): DocsManifest | null {
  if (_manifest !== undefined) return _manifest;

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    // dist/api/routes/ → dist/docs-manifest.json
    const manifestPath = path.resolve(__dirname, "..", "..", "docs-manifest.json");

    if (existsSync(manifestPath)) {
      const raw = readFileSync(manifestPath, "utf-8");
      _manifest = JSON.parse(raw) as DocsManifest;
      logger.debug("docs:manifest:loaded", { path: manifestPath, tools: _manifest.tools.length, routes: _manifest.routes.length, docs: _manifest.docs.length });
      return _manifest;
    }
  } catch (err) {
    logger.warn("docs:manifest:error", { error: String(err) });
  }

  _manifest = null;
  return null;
}

// ── Cached introspection results ────────────────────

let _toolsCache: ReturnType<typeof introspectTools> | null = null;
let _routesCache: ReturnType<typeof introspectRoutes> | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

function getTools(basePath: string): ReturnType<typeof introspectTools> {
  if (_toolsCache && Date.now() - _cacheTimestamp < CACHE_TTL_MS) return _toolsCache;

  // Try live filesystem first (dev mode)
  const toolsDir = path.join(basePath, "src", "mcp", "tools");
  if (existsSync(toolsDir)) {
    _toolsCache = introspectTools(toolsDir);
    _cacheTimestamp = Date.now();
    return _toolsCache;
  }

  // Fallback to manifest (npm-installed mode)
  const manifest = loadManifest();
  return manifest?.tools ?? [];
}

function getRoutes(basePath: string): ReturnType<typeof introspectRoutes> {
  if (_routesCache && Date.now() - _cacheTimestamp < CACHE_TTL_MS) return _routesCache;

  // Try live filesystem first (dev mode)
  const apiDir = path.join(basePath, "src", "api");
  if (existsSync(apiDir)) {
    _routesCache = introspectRoutes(apiDir);
    _cacheTimestamp = Date.now();
    return _routesCache;
  }

  // Fallback to manifest (npm-installed mode)
  const manifest = loadManifest();
  return manifest?.routes ?? [];
}

// ── Doc file discovery ──────────────────────────────

interface DocEntry {
  slug: string;
  title: string;
  category: string;
  path: string;
}

function discoverDocs(basePath: string): DocEntry[] {
  // Try live filesystem first (dev mode)
  const docsDir = path.join(basePath, "docs");
  if (existsSync(docsDir)) {
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

  // Fallback to manifest (npm-installed mode)
  const manifest = loadManifest();
  if (manifest) {
    return manifest.docs.map((d) => ({
      slug: d.slug,
      title: d.title,
      category: d.category,
      path: "", // no filesystem path in manifest mode
    }));
  }

  return [];
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

      // Try live filesystem first (dev mode)
      const filePath = path.join(getBasePath(), "docs", category, `${slug}.md`);
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, "utf-8");
        logger.debug("docs:read", { category, slug });
        res.json({ slug: `${category}/${slug}`, content });
        return;
      }

      // Fallback to manifest (npm-installed mode)
      const manifest = loadManifest();
      const fullSlug = `${category}/${slug}`;
      const entry = manifest?.docs.find((d) => d.slug === fullSlug);
      if (entry) {
        logger.debug("docs:read:manifest", { category, slug });
        res.json({ slug: fullSlug, content: entry.content });
        return;
      }

      res.status(404).json({ error: `Doc not found: ${category}/${slug}` });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
