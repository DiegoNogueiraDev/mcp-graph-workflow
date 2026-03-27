/**
 * LspAnalyzer — CodeAnalyzer implementation backed by Language Server Protocol.
 * Stub implementation: returns empty symbols/relations for now.
 * Full LSP-based analysis (documentSymbol → CodeSymbol mapping) will be
 * implemented when integration testing with real language servers is in place.
 */

import type { AnalyzedFile, CodeAnalyzer } from "../code/code-types.js";
import type { LspClient } from "./lsp-client.js";
import { logger } from "../utils/logger.js";

export class LspAnalyzer implements CodeAnalyzer {
  readonly languages: string[];
  readonly extensions: string[];

  constructor(
    private readonly client: LspClient,
    languages: string[],
    extensions: string[],
  ) {
    this.languages = languages;
    this.extensions = extensions;
  }

  async analyzeFile(filePath: string, basePath: string): Promise<AnalyzedFile> {
    logger.debug("lsp-analyzer:analyze", { filePath, languages: this.languages.join(",") });

    // Normalize path separators for cross-platform compatibility
    const relative = filePath
      .replace(basePath + "/", "")
      .replace(basePath + "\\", "");

    return {
      file: relative,
      symbols: [],
      relations: [],
    };
  }
}
