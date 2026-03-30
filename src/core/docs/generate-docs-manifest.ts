/**
 * Generate Docs Manifest — build-time script that pre-computes
 * tools, routes, and docs into a single JSON file for npm-installed users.
 *
 * Run after `tsc`: `node dist/core/docs/generate-docs-manifest.js`
 */

import { writeFileSync, readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { introspectTools } from "./tool-introspector.js";
import { introspectRoutes } from "./route-introspector.js";
import type { ToolInfo } from "./tool-introspector.js";
import type { RouteInfo } from "./route-introspector.js";

interface ManifestDocEntry {
  slug: string;
  title: string;
  category: string;
  content: string;
}

export interface DocsManifest {
  generatedAt: string;
  tools: ToolInfo[];
  routes: RouteInfo[];
  docs: ManifestDocEntry[];
}

function discoverDocsWithContent(docsDir: string): ManifestDocEntry[] {
  if (!existsSync(docsDir)) return [];

  const entries: ManifestDocEntry[] = [];
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
      const content = readFileSync(path.join(catDir, file), "utf-8");

      entries.push({ slug, title, category, content });
    }
  }

  return entries;
}

function generate(): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Resolve project root: dist/core/docs/ → project root
  const projectRoot = path.resolve(__dirname, "..", "..", "..");

  const toolsDir = path.join(projectRoot, "src", "mcp", "tools");
  const apiDir = path.join(projectRoot, "src", "api");
  const docsDir = path.join(projectRoot, "docs");
  const outPath = path.join(projectRoot, "dist", "docs-manifest.json");

  const tools = existsSync(toolsDir) ? introspectTools(toolsDir) : [];
  const routes = existsSync(apiDir) ? introspectRoutes(apiDir) : [];
  const docs = discoverDocsWithContent(docsDir);

  const manifest: DocsManifest = {
    generatedAt: new Date().toISOString(),
    tools,
    routes,
    docs,
  };

  writeFileSync(outPath, JSON.stringify(manifest, null, 2), "utf-8");

  // eslint-disable-next-line no-console
  console.log(
    `[docs-manifest] Generated: ${tools.length} tools, ${routes.length} routes, ${docs.length} docs → ${outPath}`,
  );
}

generate();
