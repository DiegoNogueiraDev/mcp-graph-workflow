/**
 * TreeSitterManager — Lazy-loads web-tree-sitter WASM runtime and
 * caches Parser instances per language. Grammars are loaded on-demand
 * from npm packages (tree-sitter-{lang}).
 *
 * Pattern: same lazy-loading approach as ts-analyzer.ts loadTypeScript().
 * Graceful degradation: missing grammar → returns null, never throws.
 */

import { join } from "node:path";
import { existsSync } from "node:fs";
import { logger } from "../../utils/logger.js";

// ── Types from web-tree-sitter ───────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParserModule = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParserInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LanguageInstance = any;

// ── Grammar registry ─────────────────────────────────────

/** Maps languageId → npm package name + wasm file name */
const GRAMMAR_REGISTRY: Record<string, { pkg: string; wasm: string }> = {
  python:  { pkg: "tree-sitter-python",  wasm: "tree-sitter-python.wasm" },
  go:      { pkg: "tree-sitter-go",      wasm: "tree-sitter-go.wasm" },
  rust:    { pkg: "tree-sitter-rust",    wasm: "tree-sitter-rust.wasm" },
  java:    { pkg: "tree-sitter-java",    wasm: "tree-sitter-java.wasm" },
  c:       { pkg: "tree-sitter-c",       wasm: "tree-sitter-c.wasm" },
  cpp:     { pkg: "tree-sitter-cpp",     wasm: "tree-sitter-cpp.wasm" },
  ruby:    { pkg: "tree-sitter-ruby",    wasm: "tree-sitter-ruby.wasm" },
  php:     { pkg: "tree-sitter-php",     wasm: "tree-sitter-php.wasm" },
  csharp:  { pkg: "tree-sitter-c-sharp", wasm: "tree-sitter-c_sharp.wasm" },
  lua:     { pkg: "tree-sitter-lua",     wasm: "tree-sitter-lua.wasm" },
};

// ── Lazy loader state ────────────────────────────────────

interface TreeSitterModule {
  ParserClass: ParserModule;
  LanguageClass: LanguageInstance;
}

let tsModule: TreeSitterModule | null = null;
let initAttempted = false;

async function loadWebTreeSitter(): Promise<TreeSitterModule | null> {
  if (tsModule) return tsModule;
  if (initAttempted) return null;
  initAttempted = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import("web-tree-sitter");
    // web-tree-sitter exports { Parser, Language, ... } — init() is on Parser
    const ParserClass = mod.Parser ?? mod.default;
    const LanguageClass = mod.Language;
    await ParserClass.init();
    tsModule = { ParserClass, LanguageClass };
    logger.info("treesitter-manager:init", { message: "web-tree-sitter WASM runtime loaded" });
    return tsModule;
  } catch (err) {
    logger.warn("treesitter-manager:unavailable", {
      message: "web-tree-sitter not found — multi-language code analysis disabled",
      error: String(err),
    });
    return null;
  }
}

/** Check if web-tree-sitter is available at runtime. */
export async function isTreeSitterAvailable(): Promise<boolean> {
  const result = await loadWebTreeSitter();
  return result !== null;
}

/** Reset loader state (for testing). */
export function resetTreeSitterLoader(): void {
  tsModule = null;
  initAttempted = false;
}

// ── Resolve grammar WASM path ────────────────────────────

function resolveGrammarPath(languageId: string): string | null {
  const entry = GRAMMAR_REGISTRY[languageId];
  if (!entry) return null;

  try {
    // Resolve the package path via require.resolve
    const pkgMain = require.resolve(`${entry.pkg}/package.json`);
    const pkgDir = pkgMain.replace(/[/\\]package\.json$/, "");
    const wasmPath = join(pkgDir, entry.wasm);

    if (existsSync(wasmPath)) {
      return wasmPath;
    }

    logger.debug("treesitter-manager:wasm-not-found", { languageId, wasmPath });
    return null;
  } catch {
    logger.debug("treesitter-manager:pkg-not-found", { languageId, pkg: entry.pkg });
    return null;
  }
}

// ── TreeSitterManager class ──────────────────────────────

export class TreeSitterManager {
  private parsers: Map<string, ParserInstance> = new Map();
  private failedLanguages: Set<string> = new Set();

  /** Initialize the WASM runtime. Safe to call multiple times. */
  async initialize(): Promise<void> {
    await loadWebTreeSitter();
  }

  /**
   * Get a parser for a specific language. Returns null if:
   * - web-tree-sitter is not available
   * - Grammar WASM not installed for this language
   * - Language is not in the registry
   */
  async getParser(languageId: string): Promise<ParserInstance | null> {
    // Check cache
    const cached = this.parsers.get(languageId);
    if (cached) return cached;

    // Already failed for this language — don't retry
    if (this.failedLanguages.has(languageId)) return null;

    // Not in registry
    if (!GRAMMAR_REGISTRY[languageId]) {
      this.failedLanguages.add(languageId);
      return null;
    }

    // Load WASM runtime
    const wts = await loadWebTreeSitter();
    if (!wts) return null;

    // Resolve grammar path
    const wasmPath = resolveGrammarPath(languageId);
    if (!wasmPath) {
      this.failedLanguages.add(languageId);
      logger.info("treesitter-manager:grammar-unavailable", {
        languageId,
        message: `Grammar for ${languageId} not installed — skipping`,
      });
      return null;
    }

    try {
      const language: LanguageInstance = await wts.LanguageClass.load(wasmPath);
      const parser = new wts.ParserClass();
      parser.setLanguage(language);

      // Cache the parser
      this.parsers.set(languageId, parser);

      logger.info("treesitter-manager:parser-loaded", {
        languageId,
        wasmPath,
      });

      return parser;
    } catch (err) {
      this.failedLanguages.add(languageId);
      logger.warn("treesitter-manager:parser-load-failed", {
        languageId,
        error: String(err),
      });
      return null;
    }
  }

  /** Check if a language has a grammar registered. */
  isLanguageSupported(languageId: string): boolean {
    return languageId in GRAMMAR_REGISTRY;
  }

  /** Get list of all registered language IDs. */
  getSupportedLanguages(): string[] {
    return Object.keys(GRAMMAR_REGISTRY);
  }
}
