/**
 * MCP Tool: code_intelligence
 * Semantic code intelligence via LSP — multi-language support.
 */

import { z } from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SqliteStore } from "../../core/store/sqlite-store.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { LspBridge } from "../../core/lsp/lsp-bridge.js";
import { LspServerManager } from "../../core/lsp/lsp-server-manager.js";
import { LspCache } from "../../core/lsp/lsp-cache.js";
import { LspDiagnosticsCollector } from "../../core/lsp/lsp-diagnostics.js";
import { LspEditApplier } from "../../core/lsp/lsp-edit-applier.js";
import { ServerRegistry } from "../../core/lsp/server-registry.js";
import { detectProjectLanguages } from "../../core/lsp/language-detector.js";
import { estimateTokens } from "../../core/context/token-estimator.js";
import { logger } from "../../core/utils/logger.js";
import { mcpText, mcpError } from "../response-helpers.js";
import type { LspCodeAction } from "../../core/lsp/lsp-types.js";

// ---------------------------------------------------------------------------
// Mode enum
// ---------------------------------------------------------------------------

const CODE_INTEL_MODES = z.enum([
  "definition",
  "references",
  "hover",
  "rename",
  "call_hierarchy_in",
  "call_hierarchy_out",
  "type_hierarchy_super",
  "type_hierarchy_sub",
  "diagnostics",
  "document_symbols",
  "workspace_symbols",
  "languages",
  "status",
  "apply_rename",
  "format_document",
  "format_range",
  "code_actions",
  "apply_code_action",
]);

// ---------------------------------------------------------------------------
// Singleton instances (lazy-initialized per process)
// ---------------------------------------------------------------------------

let bridge: LspBridge | null = null;
let manager: LspServerManager | null = null;
let registry: ServerRegistry | null = null;
const editApplier = new LspEditApplier();
let lastCodeActions: LspCodeAction[] = [];
let lastCodeActionsFile: string | null = null;

/** @internal — exported for testing */
export function resetSingletons(): void {
  bridge = null;
  manager = null;
  registry = null;
  lastCodeActions = [];
  lastCodeActionsFile = null;
}

/** @internal — exported for testing stale cache */
export function getLastCodeActionsFile(): string | null {
  return lastCodeActionsFile;
}

function getOrCreateRegistry(): ServerRegistry {
  if (!registry) {
    registry = new ServerRegistry();
  }
  return registry;
}

function getOrCreateBridge(store: SqliteStore): LspBridge {
  if (bridge) return bridge;

  const reg = getOrCreateRegistry();
  const basePath = process.cwd();
  const rootUri = `file://${basePath}`;

  manager = new LspServerManager(reg, rootUri);
  const cache = new LspCache(store.getDb());
  const diagnostics = new LspDiagnosticsCollector();

  bridge = new LspBridge(manager, cache, diagnostics, basePath);
  return bridge;
}

// ---------------------------------------------------------------------------
// Extracted handlers (testable)
// ---------------------------------------------------------------------------

/** @internal — exported for testing */
export function handleLanguages(): ReturnType<typeof mcpText> {
  const reg = getOrCreateRegistry();
  const basePath = process.cwd();

  const detected = detectProjectLanguages(basePath, reg);

  const response = {
    ok: true,
    mode: "languages" as const,
    detected: detected.map((d) => ({
      languageId: d.languageId,
      fileCount: d.fileCount,
      confidence: d.confidence,
      detectedVia: d.detectedVia,
      configFile: d.configFile,
      serverCommand: reg.getConfigForLanguage(d.languageId)?.command ?? "unknown",
    })),
    supportedLanguages: reg.getAllConfigs().map((c) => c.languageId),
  };

  const text = JSON.stringify(response, null, 2);
  return mcpText({ ...response, estimatedTokens: estimateTokens(text) });
}

/** @internal — exported for testing */
export function handleStatus(): ReturnType<typeof mcpText> {
  const statuses: Record<string, string> = {};

  if (manager) {
    for (const [lang, state] of manager.getStatus()) {
      statuses[lang] = state.status;
    }
  }

  const response = {
    ok: true,
    mode: "status" as const,
    servers: statuses,
    bridgeInitialized: bridge !== null,
  };

  return mcpText(response);
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerCodeIntelligence(server: McpServer, store: SqliteStore): void {
  server.tool(
    "code_intelligence",
    "Semantic code intelligence via LSP. Multi-language (TypeScript, Python, Rust, Go, Java, C/C++, Ruby, PHP, Kotlin, Swift, C#, Lua). Modes: definition, references, hover, rename, call_hierarchy_in/out, diagnostics, document_symbols, workspace_symbols, languages, status, apply_rename, format_document, format_range, code_actions, apply_code_action.",
    {
      mode: CODE_INTEL_MODES.describe("Operation mode"),
      file: z.string().optional().describe("Relative file path (required for most modes)"),
      line: z.number().int().min(1).optional().describe("1-based line number"),
      character: z.number().int().min(0).optional().describe("0-based character offset"),
      query: z.string().optional().describe("Search query (workspace_symbols mode)"),
      newName: z.string().optional().describe("New name (rename mode)"),
      startLine: z.number().int().min(1).optional().describe("Start line for range operations (1-based)"),
      endLine: z.number().int().min(1).optional().describe("End line for range operations (1-based)"),
      endCharacter: z.number().int().min(0).optional().describe("End character for range operations (0-based)"),
      actionIndex: z.number().int().min(0).optional().describe("Index of code action to apply (from code_actions results)"),
      actionKinds: z.array(z.string()).optional().describe("Filter code action kinds (e.g. ['quickfix', 'source.organizeImports'])"),
    },
    async ({ mode, file, line, character, query, newName, startLine, endLine, endCharacter, actionIndex, actionKinds }) => {
      try {
        logger.info("tool:code_intelligence", {
          mode,
          file: file ?? "",
          ...(actionIndex !== undefined ? { actionIndex } : {}),
          ...(newName ? { newName } : {}),
          ...(startLine ? { startLine, endLine } : {}),
        });

        // Modes that don't need bridge
        if (mode === "languages") {
          return handleLanguages();
        }
        if (mode === "status") {
          return handleStatus();
        }

        const lspBridge = getOrCreateBridge(store);

        switch (mode) {
          case "definition": {
            if (!file || !line || character === undefined) {
              return mcpError("definition mode requires: file, line, character");
            }
            const defs = await lspBridge.goToDefinition(file, line, character);
            const response = {
              ok: true,
              mode: "definition",
              definitions: defs.map((d) => ({
                ...d,
                hint: `Read lines ${d.startLine}-${d.endLine} of ${d.file}`,
              })),
              lspAvailable: defs.length > 0,
            };
            const text = JSON.stringify(response, null, 2);
            return mcpText({ ...response, estimatedTokens: estimateTokens(text) });
          }

          case "references": {
            if (!file || !line || character === undefined) {
              return mcpError("references mode requires: file, line, character");
            }
            const refs = await lspBridge.findReferences(file, line, character);
            // Adaptive response: L1 full, L2 grouped, L3 summary
            const byFile: Record<string, number> = {};
            for (const ref of refs) {
              byFile[ref.file] = (byFile[ref.file] ?? 0) + 1;
            }
            const response =
              refs.length > 100
                ? {
                    ok: true,
                    mode: "references",
                    totalReferences: refs.length,
                    byFile,
                    tier: "summary" as const,
                  }
                : refs.length > 20
                  ? {
                      ok: true,
                      mode: "references",
                      totalReferences: refs.length,
                      references: refs.slice(0, 20),
                      byFile,
                      tier: "grouped" as const,
                    }
                  : {
                      ok: true,
                      mode: "references",
                      totalReferences: refs.length,
                      references: refs,
                      tier: "full" as const,
                    };
            const text = JSON.stringify(response, null, 2);
            return mcpText({ ...response, estimatedTokens: estimateTokens(text) });
          }

          case "hover": {
            if (!file || !line || character === undefined) {
              return mcpError("hover mode requires: file, line, character");
            }
            const hover = await lspBridge.hover(file, line, character);
            const response = hover
              ? { ok: true, mode: "hover" as const, ...hover }
              : { ok: true, mode: "hover" as const, signature: null, lspAvailable: false };
            const text = JSON.stringify(response, null, 2);
            return mcpText({ ...response, estimatedTokens: estimateTokens(text) });
          }

          case "rename": {
            if (!file || !line || character === undefined || !newName) {
              return mcpError("rename mode requires: file, line, character, newName");
            }
            const edit = await lspBridge.rename(file, line, character, newName);
            const response = edit
              ? {
                  ok: true,
                  mode: "rename" as const,
                  newName,
                  totalFiles: new Set(edit.changes.map((c) => c.file)).size,
                  totalEdits: edit.changes.length,
                  edits: edit.changes,
                }
              : { ok: true, mode: "rename" as const, lspAvailable: false };
            const text = JSON.stringify(response, null, 2);
            return mcpText({ ...response, estimatedTokens: estimateTokens(text) });
          }

          case "call_hierarchy_in": {
            if (!file || !line || character === undefined) {
              return mcpError("call_hierarchy_in mode requires: file, line, character");
            }
            const items = await lspBridge.callHierarchyIncoming(file, line, character);
            const response = { ok: true, mode: "call_hierarchy_in" as const, items };
            const text = JSON.stringify(response, null, 2);
            return mcpText({ ...response, estimatedTokens: estimateTokens(text) });
          }

          case "call_hierarchy_out": {
            if (!file || !line || character === undefined) {
              return mcpError("call_hierarchy_out mode requires: file, line, character");
            }
            const items = await lspBridge.callHierarchyOutgoing(file, line, character);
            const response = { ok: true, mode: "call_hierarchy_out" as const, items };
            const text = JSON.stringify(response, null, 2);
            return mcpText({ ...response, estimatedTokens: estimateTokens(text) });
          }

          case "type_hierarchy_super":
          case "type_hierarchy_sub": {
            return mcpText({
              ok: true,
              mode,
              supported: false,
              message: "Type hierarchy not yet implemented",
            });
          }

          case "diagnostics": {
            if (!file) return mcpError("diagnostics mode requires: file");
            const diags = await lspBridge.getDiagnostics(file);
            const response = { ok: true, mode: "diagnostics" as const, file, diagnostics: diags };
            const text = JSON.stringify(response, null, 2);
            return mcpText({ ...response, estimatedTokens: estimateTokens(text) });
          }

          case "document_symbols": {
            if (!file) return mcpError("document_symbols mode requires: file");
            const syms = await lspBridge.getDocumentSymbols(file);
            const response = { ok: true, mode: "document_symbols" as const, file, symbols: syms };
            const text = JSON.stringify(response, null, 2);
            return mcpText({ ...response, estimatedTokens: estimateTokens(text) });
          }

          case "workspace_symbols": {
            if (!query) return mcpError("workspace_symbols mode requires: query");
            return mcpText({
              ok: true,
              mode: "workspace_symbols",
              supported: false,
              message: "Use 'search' tool for workspace symbol search",
            });
          }

          // -----------------------------------------------------------------
          // Edit operations — apply changes to disk via LSP
          // -----------------------------------------------------------------

          case "apply_rename": {
            if (!file || !line || character === undefined || !newName) {
              return mcpError("apply_rename mode requires: file, line, character, newName");
            }
            const wsEdit = await lspBridge.rename(file, line, character, newName);
            if (!wsEdit || wsEdit.changes.length === 0) {
              return mcpText({ ok: true, mode: "apply_rename" as const, lspAvailable: false, message: "LSP returned no edits" });
            }
            const renameResult = await editApplier.applyWorkspaceEdit(wsEdit);
            if (renameResult.applied) {
              for (const f of renameResult.filesModified) {
                const content = await readFile(f, "utf-8");
                const rel = path.relative(process.cwd(), f);
                await lspBridge.notifyDocumentChanged(rel, content);
              }
            }
            const renameResp = {
              ok: renameResult.applied,
              mode: "apply_rename" as const,
              newName,
              filesModified: renameResult.filesModified.map((f) => path.relative(process.cwd(), f)),
              totalEdits: renameResult.totalEdits,
              errors: renameResult.errors,
            };
            return mcpText({ ...renameResp, estimatedTokens: estimateTokens(JSON.stringify(renameResp)) });
          }

          case "format_document": {
            if (!file) return mcpError("format_document mode requires: file");
            const fmtEdits = await lspBridge.formatDocument(file);
            if (fmtEdits.length === 0) {
              return mcpText({ ok: true, mode: "format_document" as const, message: "No formatting changes needed" });
            }
            const fmtResult = await editApplier.applyWorkspaceEdit({ changes: fmtEdits });
            if (fmtResult.applied) {
              const absFile = path.resolve(process.cwd(), file);
              const content = await readFile(absFile, "utf-8");
              await lspBridge.notifyDocumentChanged(file, content);
            }
            const fmtResp = {
              ok: fmtResult.applied,
              mode: "format_document" as const,
              file,
              totalEdits: fmtResult.totalEdits,
              errors: fmtResult.errors,
            };
            return mcpText({ ...fmtResp, estimatedTokens: estimateTokens(JSON.stringify(fmtResp)) });
          }

          case "format_range": {
            if (!file || !startLine || !endLine) {
              return mcpError("format_range mode requires: file, startLine, endLine");
            }
            const rangeEdits = await lspBridge.formatRange(
              file, startLine, 0, endLine, endCharacter ?? 0,
            );
            if (rangeEdits.length === 0) {
              return mcpText({ ok: true, mode: "format_range" as const, message: "No formatting changes needed" });
            }
            const rangeResult = await editApplier.applyWorkspaceEdit({ changes: rangeEdits });
            if (rangeResult.applied) {
              const absFile = path.resolve(process.cwd(), file);
              const content = await readFile(absFile, "utf-8");
              await lspBridge.notifyDocumentChanged(file, content);
            }
            const rangeResp = {
              ok: rangeResult.applied,
              mode: "format_range" as const,
              file,
              totalEdits: rangeResult.totalEdits,
              errors: rangeResult.errors,
            };
            return mcpText({ ...rangeResp, estimatedTokens: estimateTokens(JSON.stringify(rangeResp)) });
          }

          case "code_actions": {
            if (!file || !line || character === undefined) {
              return mcpError("code_actions mode requires: file, line, character");
            }
            const el = endLine ?? line;
            const ec = endCharacter ?? character;
            const actions = await lspBridge.getCodeActions(file, line, character, el, ec, actionKinds);
            lastCodeActions = actions;
            lastCodeActionsFile = file;
            const actionsResp = {
              ok: true,
              mode: "code_actions" as const,
              file,
              actions: actions.map((a, i) => ({
                index: i,
                title: a.title,
                kind: a.kind,
                isPreferred: a.isPreferred,
                hasEdit: !!a.edit,
              })),
            };
            return mcpText({ ...actionsResp, estimatedTokens: estimateTokens(JSON.stringify(actionsResp)) });
          }

          case "apply_code_action": {
            if (actionIndex === undefined) {
              return mcpError("apply_code_action mode requires: actionIndex (from a previous code_actions call)");
            }
            if (actionIndex < 0 || actionIndex >= lastCodeActions.length) {
              return mcpError(`actionIndex ${actionIndex} out of range (0-${lastCodeActions.length - 1}). Run code_actions first.`);
            }
            const action = lastCodeActions[actionIndex];
            if (!action.edit || action.edit.changes.length === 0) {
              return mcpText({ ok: true, mode: "apply_code_action" as const, message: `Action "${action.title}" has no edits to apply` });
            }
            const actionResult = await editApplier.applyWorkspaceEdit(action.edit);
            if (actionResult.applied) {
              for (const f of actionResult.filesModified) {
                const content = await readFile(f, "utf-8");
                const rel = path.relative(process.cwd(), f);
                await lspBridge.notifyDocumentChanged(rel, content);
              }
            }
            const actionResp = {
              ok: actionResult.applied,
              mode: "apply_code_action" as const,
              actionTitle: action.title,
              filesModified: actionResult.filesModified.map((f) => path.relative(process.cwd(), f)),
              totalEdits: actionResult.totalEdits,
              errors: actionResult.errors,
            };
            return mcpText({ ...actionResp, estimatedTokens: estimateTokens(JSON.stringify(actionResp)) });
          }

          default:
            return mcpError(`Unknown mode: ${mode}`);
        }
      } catch (err) {
        logger.error("code_intelligence:error", {
          mode,
          file: file ?? "",
          error: err instanceof Error ? err.message : String(err),
        });
        return mcpError(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
