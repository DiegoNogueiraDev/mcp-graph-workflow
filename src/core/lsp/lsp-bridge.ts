/**
 * LspBridge — High-level API that routes LSP operations to the correct
 * language server via LspServerManager, with caching via LspCache.
 *
 * Provides goToDefinition, findReferences, hover, rename, call hierarchy,
 * document symbols, and diagnostics — all with graceful degradation when
 * a language server is unavailable.
 */

import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type {
  LspLocation,
  LspHoverResult,
  LspDiagnostic,
  LspCallHierarchyItem,
  LspDocumentSymbol,
  LspServerState,
  LspTextEdit,
  LspWorkspaceEdit,
  LspCodeAction,
} from "./lsp-types.js";
import type { LspServerManager } from "./lsp-server-manager.js";
import type { LspCache } from "./lsp-cache.js";
import type { LspDiagnosticsCollector } from "./lsp-diagnostics.js";
import { logger } from "../utils/logger.js";

// ---------------------------------------------------------------------------
// Raw LSP response types (from the protocol, before normalization)
// ---------------------------------------------------------------------------

interface RawLspLocation {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

interface RawLspHoverResult {
  contents:
    | string
    | { kind: string; value: string }
    | Array<string | { kind: string; value: string }>;
}

interface RawLspWorkspaceEdit {
  changes?: Record<string, Array<{
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    newText: string;
  }>>;
  documentChanges?: Array<{
    textDocument: { uri: string };
    edits: Array<{
      range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
      newText: string;
    }>;
  }>;
}

interface RawCallHierarchyItem {
  name: string;
  kind: number;
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

interface RawIncomingCall {
  from: RawCallHierarchyItem;
}

interface RawOutgoingCall {
  to: RawCallHierarchyItem;
}

interface RawDocumentSymbol {
  name: string;
  kind: number;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  children?: RawDocumentSymbol[];
}

// ---------------------------------------------------------------------------
// Symbol kind mapping (LSP spec numbers → readable strings)
// ---------------------------------------------------------------------------

const SYMBOL_KIND_MAP: Record<number, string> = {
  1: "File", 2: "Module", 3: "Namespace", 4: "Package",
  5: "Class", 6: "Method", 7: "Property", 8: "Field",
  9: "Constructor", 10: "Enum", 11: "Interface", 12: "Function",
  13: "Variable", 14: "Constant", 15: "String", 16: "Number",
  17: "Boolean", 18: "Array", 19: "Object", 20: "Key",
  21: "Null", 22: "EnumMember", 23: "Struct", 24: "Event",
  25: "Operator", 26: "TypeParameter",
};

// ---------------------------------------------------------------------------
// LspBridge
// ---------------------------------------------------------------------------

export class LspBridge {
  private readonly documentVersions = new Map<string, number>();

  constructor(
    private readonly manager: LspServerManager,
    private readonly cache: LspCache | null,
    private readonly diagnostics: LspDiagnosticsCollector,
    private readonly basePath: string,
  ) {}

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  async goToDefinition(file: string, line: number, character: number): Promise<LspLocation[]> {
    const raw = await this.executeWithCache<RawLspLocation | RawLspLocation[]>(
      "definition",
      file,
      line,
      character,
      "textDocument/definition",
      {
        textDocument: { uri: this.toFileUri(file) },
        position: { line: line - 1, character },
      },
    );

    if (!raw) {
      return [];
    }

    const locations = Array.isArray(raw) ? raw : [raw];
    return locations.map((loc) => this.normalizeLocation(loc));
  }

  async findReferences(file: string, line: number, character: number): Promise<LspLocation[]> {
    const raw = await this.executeWithCache<RawLspLocation[]>(
      "references",
      file,
      line,
      character,
      "textDocument/references",
      {
        textDocument: { uri: this.toFileUri(file) },
        position: { line: line - 1, character },
        context: { includeDeclaration: true },
      },
    );

    if (!raw) {
      return [];
    }

    return raw.map((loc) => this.normalizeLocation(loc));
  }

  async hover(file: string, line: number, character: number): Promise<LspHoverResult | null> {
    const raw = await this.executeWithCache<RawLspHoverResult>(
      "hover",
      file,
      line,
      character,
      "textDocument/hover",
      {
        textDocument: { uri: this.toFileUri(file) },
        position: { line: line - 1, character },
      },
    );

    if (!raw) {
      return null;
    }

    return this.normalizeHover(raw);
  }

  async rename(
    file: string,
    line: number,
    character: number,
    newName: string,
  ): Promise<LspWorkspaceEdit | null> {
    // Rename is NEVER cached — it is a write operation.
    const absPath = path.resolve(this.basePath, file);
    const client = await this.manager.getClientForFile(absPath);

    if (!client) {
      logger.warn("lsp-bridge:rename no server available", { file });
      return null;
    }

    await this.ensureDocumentOpen(client, file, absPath);

    try {
      const raw = await client.sendRequest<RawLspWorkspaceEdit>(
        "textDocument/rename",
        {
          textDocument: { uri: this.toFileUri(file) },
          position: { line: line - 1, character },
          newName,
        },
      );

      if (!raw) {
        return null;
      }

      return this.normalizeWorkspaceEdit(raw);
    } catch (err) {
      logger.error("lsp-bridge:rename failed", {
        file,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  async callHierarchyIncoming(
    file: string,
    line: number,
    character: number,
  ): Promise<LspCallHierarchyItem[]> {
    const client = await this.manager.getClientForFile(
      path.resolve(this.basePath, file),
    );

    if (!client) {
      logger.warn("lsp-bridge:callHierarchyIncoming no server available", { file });
      return [];
    }

    try {
      // Ensure document is open (LSP protocol requires didOpen before queries)
      const absPath = path.resolve(this.basePath, file);
      await this.ensureDocumentOpen(client, file, absPath);

      // Step 1: prepareCallHierarchy
      const items = await client.sendRequest<RawCallHierarchyItem[]>(
        "textDocument/prepareCallHierarchy",
        {
          textDocument: { uri: this.toFileUri(file) },
          position: { line: line - 1, character },
        },
      );

      if (!items || items.length === 0) {
        return [];
      }

      // Step 2: incomingCalls for the first item
      const incoming = await client.sendRequest<RawIncomingCall[]>(
        "callHierarchy/incomingCalls",
        { item: items[0] },
      );

      if (!incoming) {
        return [];
      }

      return incoming.map((call) => this.normalizeCallHierarchyItem(call.from));
    } catch (err) {
      logger.error("lsp-bridge:callHierarchyIncoming failed", {
        file,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  async callHierarchyOutgoing(
    file: string,
    line: number,
    character: number,
  ): Promise<LspCallHierarchyItem[]> {
    const client = await this.manager.getClientForFile(
      path.resolve(this.basePath, file),
    );

    if (!client) {
      logger.warn("lsp-bridge:callHierarchyOutgoing no server available", { file });
      return [];
    }

    try {
      // Ensure document is open (LSP protocol requires didOpen before queries)
      const absPath = path.resolve(this.basePath, file);
      await this.ensureDocumentOpen(client, file, absPath);

      // Step 1: prepareCallHierarchy
      const items = await client.sendRequest<RawCallHierarchyItem[]>(
        "textDocument/prepareCallHierarchy",
        {
          textDocument: { uri: this.toFileUri(file) },
          position: { line: line - 1, character },
        },
      );

      if (!items || items.length === 0) {
        return [];
      }

      // Step 2: outgoingCalls for the first item
      const outgoing = await client.sendRequest<RawOutgoingCall[]>(
        "callHierarchy/outgoingCalls",
        { item: items[0] },
      );

      if (!outgoing) {
        return [];
      }

      return outgoing.map((call) => this.normalizeCallHierarchyItem(call.to));
    } catch (err) {
      logger.error("lsp-bridge:callHierarchyOutgoing failed", {
        file,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  async getDocumentSymbols(file: string): Promise<LspDocumentSymbol[]> {
    const raw = await this.executeWithCache<RawDocumentSymbol[]>(
      "documentSymbol",
      file,
      0,
      0,
      "textDocument/documentSymbol",
      {
        textDocument: { uri: this.toFileUri(file) },
      },
    );

    if (!raw) {
      return [];
    }

    return raw.map((sym) => this.normalizeDocumentSymbol(file, sym));
  }

  async getDiagnostics(file: string): Promise<LspDiagnostic[]> {
    // Diagnostics are pushed by the server, not requested — return from collector.
    return this.diagnostics.getForFile(file);
  }

  async getLanguageStatus(): Promise<Map<string, LspServerState>> {
    return this.manager.getStatus();
  }

  // -----------------------------------------------------------------------
  // Edit operations — formatting, code actions, document sync
  // -----------------------------------------------------------------------

  async formatDocument(
    file: string,
    options?: { tabSize?: number; insertSpaces?: boolean },
  ): Promise<LspTextEdit[]> {
    const absPath = path.resolve(this.basePath, file);
    const client = await this.manager.getClientForFile(absPath);

    if (!client) {
      logger.warn("lsp-bridge:formatDocument no server available", { file });
      return [];
    }

    await this.ensureDocumentOpen(client, file, absPath);

    try {
      const raw = await client.sendRequest<Array<{
        range: { start: { line: number; character: number }; end: { line: number; character: number } };
        newText: string;
      }>>("textDocument/formatting", {
        textDocument: { uri: this.toFileUri(file) },
        options: {
          tabSize: options?.tabSize ?? 2,
          insertSpaces: options?.insertSpaces ?? true,
        },
      });

      if (!raw) return [];

      return raw.map((edit) => ({
        file,
        startLine: edit.range.start.line + 1,
        startCharacter: edit.range.start.character,
        endLine: edit.range.end.line + 1,
        endCharacter: edit.range.end.character,
        newText: edit.newText,
      }));
    } catch (err) {
      logger.error("lsp-bridge:formatDocument failed", {
        file,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  async formatRange(
    file: string,
    startLine: number,
    startCharacter: number,
    endLine: number,
    endCharacter: number,
    options?: { tabSize?: number; insertSpaces?: boolean },
  ): Promise<LspTextEdit[]> {
    const absPath = path.resolve(this.basePath, file);
    const client = await this.manager.getClientForFile(absPath);

    if (!client) {
      logger.warn("lsp-bridge:formatRange no server available", { file });
      return [];
    }

    await this.ensureDocumentOpen(client, file, absPath);

    try {
      const raw = await client.sendRequest<Array<{
        range: { start: { line: number; character: number }; end: { line: number; character: number } };
        newText: string;
      }>>("textDocument/rangeFormatting", {
        textDocument: { uri: this.toFileUri(file) },
        range: {
          start: { line: startLine - 1, character: startCharacter },
          end: { line: endLine - 1, character: endCharacter },
        },
        options: {
          tabSize: options?.tabSize ?? 2,
          insertSpaces: options?.insertSpaces ?? true,
        },
      });

      if (!raw) return [];

      return raw.map((edit) => ({
        file,
        startLine: edit.range.start.line + 1,
        startCharacter: edit.range.start.character,
        endLine: edit.range.end.line + 1,
        endCharacter: edit.range.end.character,
        newText: edit.newText,
      }));
    } catch (err) {
      logger.error("lsp-bridge:formatRange failed", {
        file,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  async getCodeActions(
    file: string,
    startLine: number,
    startCharacter: number,
    endLine: number,
    endCharacter: number,
    kinds?: string[],
  ): Promise<LspCodeAction[]> {
    const absPath = path.resolve(this.basePath, file);
    const client = await this.manager.getClientForFile(absPath);

    if (!client) {
      logger.warn("lsp-bridge:getCodeActions no server available", { file });
      return [];
    }

    await this.ensureDocumentOpen(client, file, absPath);

    try {
      const raw = await client.sendRequest<Array<{
        title: string;
        kind?: string;
        isPreferred?: boolean;
        edit?: RawLspWorkspaceEdit;
        diagnostics?: Array<{
          range: { start: { line: number; character: number }; end: { line: number; character: number } };
          severity: number;
          message: string;
          code?: string;
          source?: string;
        }>;
      }>>("textDocument/codeAction", {
        textDocument: { uri: this.toFileUri(file) },
        range: {
          start: { line: startLine - 1, character: startCharacter },
          end: { line: endLine - 1, character: endCharacter },
        },
        context: {
          diagnostics: [],
          ...(kinds ? { only: kinds } : {}),
        },
      });

      if (!raw) return [];

      let actions: LspCodeAction[] = raw.map((action) => ({
        title: action.title,
        kind: action.kind,
        isPreferred: action.isPreferred,
        edit: action.edit ? this.normalizeWorkspaceEdit(action.edit) : undefined,
      }));

      // Client-side filter by kinds (some servers ignore the `only` parameter)
      if (kinds && kinds.length > 0) {
        actions = actions.filter((a) => a.kind && kinds.some((k) => a.kind!.startsWith(k)));
      }

      return actions;
    } catch (err) {
      logger.error("lsp-bridge:getCodeActions failed", {
        file,
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }

  async notifyDocumentChanged(file: string, content: string): Promise<void> {
    const absPath = path.resolve(this.basePath, file);
    const client = await this.manager.getClientForFile(absPath);

    if (!client) return;

    // Ensure document was opened first (LSP protocol requires didOpen before didChange)
    await this.ensureDocumentOpen(client, file, absPath);

    const uri = this.toFileUri(file);
    const currentVersion = this.documentVersions.get(uri) ?? 1;
    const newVersion = currentVersion + 1;
    this.documentVersions.set(uri, newVersion);

    client.sendNotification("textDocument/didChange", {
      textDocument: { uri, version: newVersion },
      contentChanges: [{ text: content }],
    });

    logger.debug("lsp-bridge:document-changed", { file, version: newVersion });
  }

  // -----------------------------------------------------------------------
  // Private helpers — cache-aware execution
  // -----------------------------------------------------------------------

  private async executeWithCache<T>(
    operation: string,
    file: string,
    line: number,
    character: number,
    lspMethod: string,
    params: unknown,
  ): Promise<T | null> {
    const absPath = path.resolve(this.basePath, file);
    const mtime = this.getFileMtime(absPath);
    const cacheKey = this.getCacheKey(operation, file, line, character);

    // 1. Check cache
    if (this.cache && mtime) {
      const cached = this.cache.get("default", cacheKey, mtime);
      if (cached != null) {
        logger.debug("lsp-bridge:cache-hit", { operation, file });
        return cached as T;
      }
    }

    // 2. Get client
    const client = await this.manager.getClientForFile(absPath);
    if (!client) {
      logger.warn("lsp-bridge:no-server", { operation, file });
      return null;
    }

    // 3. Ensure document is open (LSP servers require didOpen before queries)
    await this.ensureDocumentOpen(client, file, absPath);

    // 4. Send LSP request
    try {
      const result = await client.sendRequest<T>(lspMethod, params);

      // 5. Cache result
      if (this.cache && mtime && result != null) {
        const languageId = this.inferLanguageId(file);
        this.cache.set("default", cacheKey, operation, languageId, file, result, mtime);
      }

      return result;
    } catch (err) {
      logger.error("lsp-bridge:request-failed", {
        operation,
        file,
        lspMethod,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers — document lifecycle
  // -----------------------------------------------------------------------

  /**
   * Ensure the document is open on the LSP server (textDocument/didOpen).
   * Most servers require this before they can respond to queries.
   * Only sends once per URI (tracked via openedUris Set).
   */
  private async ensureDocumentOpen(
    client: { sendNotification: (method: string, params: unknown) => void },
    file: string,
    absPath: string,
  ): Promise<void> {
    const uri = this.toFileUri(file);
    if (this.documentVersions.has(uri)) return;

    try {
      const content = readFileSync(absPath, "utf-8");
      const languageId = this.inferLanguageId(file);

      client.sendNotification("textDocument/didOpen", {
        textDocument: {
          uri,
          languageId,
          version: 1,
          text: content,
        },
      });

      this.documentVersions.set(uri, 1);
      logger.debug("lsp-bridge:document-opened", { file, languageId });
    } catch (err) {
      logger.warn("lsp-bridge:didOpen-failed", {
        file,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // -----------------------------------------------------------------------
  // Private helpers — key generation and file utilities
  // -----------------------------------------------------------------------

  private getCacheKey(operation: string, file: string, line: number, character: number): string {
    return createHash("sha256")
      .update(operation + ":" + file + ":" + line + ":" + character)
      .digest("hex");
  }

  private getFileMtime(absPath: string): string {
    try {
      const stat = statSync(absPath);
      return stat.mtimeMs.toString();
    } catch {
      return "";
    }
  }

  private toFileUri(file: string): string {
    return "file://" + path.resolve(this.basePath, file);
  }

  private fromFileUri(uri: string): string {
    const absPath = uri.replace(/^file:\/\//, "");
    return path.relative(this.basePath, absPath);
  }

  private inferLanguageId(file: string): string {
    const ext = path.extname(file).replace(/^\./, "");
    const extMap: Record<string, string> = {
      ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
      mts: "typescript", cts: "typescript",
      py: "python", pyi: "python",
      rs: "rust",
      go: "go",
      java: "java",
      kt: "kotlin", kts: "kotlin",
      swift: "swift",
      rb: "ruby",
      php: "php",
      cs: "csharp",
      cpp: "cpp", cc: "cpp", cxx: "cpp", c: "c", h: "c", hpp: "cpp",
      lua: "lua",
    };
    return extMap[ext] ?? ext;
  }

  // -----------------------------------------------------------------------
  // Private helpers — result normalization
  // -----------------------------------------------------------------------

  private normalizeLocation(raw: RawLspLocation): LspLocation {
    return {
      file: this.fromFileUri(raw.uri),
      startLine: raw.range.start.line + 1,
      startCharacter: raw.range.start.character,
      endLine: raw.range.end.line + 1,
      endCharacter: raw.range.end.character,
    };
  }

  private normalizeHover(raw: RawLspHoverResult): LspHoverResult {
    const contents = raw.contents;

    if (typeof contents === "string") {
      return { signature: contents };
    }

    if (Array.isArray(contents)) {
      const parts = contents.map((c) =>
        typeof c === "string" ? c : c.value,
      );
      return {
        signature: parts[0] ?? "",
        documentation: parts.slice(1).join("\n") || undefined,
        language: typeof contents[0] === "object" ? contents[0].kind : undefined,
      };
    }

    // MarkupContent: { kind, value }
    return {
      signature: contents.value,
      language: contents.kind === "markdown" ? "markdown" : undefined,
    };
  }

  private normalizeWorkspaceEdit(raw: RawLspWorkspaceEdit): LspWorkspaceEdit {
    const changes: LspTextEdit[] = [];

    // Handle `changes` format
    if (raw.changes) {
      for (const [uri, edits] of Object.entries(raw.changes)) {
        const file = this.fromFileUri(uri);
        for (const edit of edits) {
          changes.push({
            file,
            startLine: edit.range.start.line + 1,
            startCharacter: edit.range.start.character,
            endLine: edit.range.end.line + 1,
            endCharacter: edit.range.end.character,
            newText: edit.newText,
          });
        }
      }
    }

    // Handle `documentChanges` format
    if (raw.documentChanges) {
      for (const docChange of raw.documentChanges) {
        const file = this.fromFileUri(docChange.textDocument.uri);
        for (const edit of docChange.edits) {
          changes.push({
            file,
            startLine: edit.range.start.line + 1,
            startCharacter: edit.range.start.character,
            endLine: edit.range.end.line + 1,
            endCharacter: edit.range.end.character,
            newText: edit.newText,
          });
        }
      }
    }

    return { changes };
  }

  private normalizeCallHierarchyItem(raw: RawCallHierarchyItem): LspCallHierarchyItem {
    return {
      name: raw.name,
      kind: SYMBOL_KIND_MAP[raw.kind] ?? `Unknown(${raw.kind})`,
      file: this.fromFileUri(raw.uri),
      startLine: raw.range.start.line + 1,
      endLine: raw.range.end.line + 1,
    };
  }

  private normalizeDocumentSymbol(file: string, raw: RawDocumentSymbol): LspDocumentSymbol {
    const result: LspDocumentSymbol = {
      name: raw.name,
      kind: SYMBOL_KIND_MAP[raw.kind] ?? `Unknown(${raw.kind})`,
      file,
      startLine: raw.range.start.line + 1,
      endLine: raw.range.end.line + 1,
    };

    if (raw.children && raw.children.length > 0) {
      result.children = raw.children.map((child) =>
        this.normalizeDocumentSymbol(file, child),
      );
    }

    return result;
  }
}
