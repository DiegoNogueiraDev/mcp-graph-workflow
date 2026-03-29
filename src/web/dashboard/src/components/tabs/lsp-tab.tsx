import { useState, useCallback } from "react";
import { useLsp } from "@/hooks/use-lsp";
import type { LspDetectedLanguage, LspDiagnostic, LspDocumentSymbol, LspLocation, LspHoverResult, LspRenameEdit } from "@/hooks/use-lsp";
import {
  RefreshCw,
  Search,
  FileCode,
  AlertTriangle,
  List,
  Code,
  Server,
  FileText,
  ChevronRight,
  ChevronDown,
  Circle,
  AlertCircle,
  Info,
  Lightbulb,
  Pencil,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Sub-tab type
// ---------------------------------------------------------------------------
type SubTab = "status" | "explorer" | "diagnostics" | "symbols";

const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: "status", label: "Status", icon: Server },
  { id: "explorer", label: "Symbol Explorer", icon: Search },
  { id: "diagnostics", label: "Diagnostics", icon: AlertTriangle },
  { id: "symbols", label: "Symbols", icon: List },
];

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------
const SEVERITY_CONFIG: Record<number, { icon: React.ElementType; color: string; label: string }> = {
  1: { icon: AlertCircle, color: "text-danger", label: "Error" },
  2: { icon: AlertTriangle, color: "text-warning", label: "Warning" },
  3: { icon: Info, color: "text-accent", label: "Info" },
  4: { icon: Lightbulb, color: "text-muted", label: "Hint" },
};

// ---------------------------------------------------------------------------
// Server status badge
// ---------------------------------------------------------------------------
function ServerStatusBadge({ status }: { status: string | undefined }): React.JSX.Element {
  const cfg: Record<string, { bg: string; text: string; border?: string }> = {
    ready: { bg: "bg-success/15", text: "text-success" },
    starting: { bg: "bg-warning/15", text: "text-warning" },
    stopped: { bg: "bg-muted/15", text: "text-muted" },
    error: { bg: "bg-danger/15", text: "text-danger" },
  };
  const resolved = status ?? "not installed";
  const style = cfg[resolved] ?? { bg: "bg-muted/10", text: "text-muted", border: "border-dashed" };

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text} ${style.border ?? ""} border border-current/20`}>
      <Circle className="w-2 h-2 fill-current" />
      {resolved}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Language card (Status sub-tab)
// ---------------------------------------------------------------------------
function LanguageCard({ lang, serverStatus }: { lang: LspDetectedLanguage; serverStatus: string | undefined }): React.JSX.Element {
  const confidencePct = Math.round(lang.confidence * 100);

  return (
    <div className="p-4 rounded-xl border border-edge bg-surface-alt shadow-sm hover:shadow-md transition-shadow space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-accent" />
          <span className="text-sm font-semibold capitalize">{lang.languageId}</span>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
          {lang.fileCount} files
        </span>
      </div>

      {/* Confidence bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-muted">
          <span>Confidence</span>
          <span>{confidencePct}%</span>
        </div>
        <div className="h-1 rounded-full bg-edge overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${confidencePct}%` }}
          />
        </div>
      </div>

      {/* Server status */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted">Server</span>
        <ServerStatusBadge status={serverStatus} />
      </div>

      {/* Detected via */}
      <div className="text-[10px] text-muted">
        Detected via: <span className="text-foreground">{lang.detectedVia}</span>
      </div>

      {/* Server command */}
      {lang.serverCommand && (
        <div className="text-[10px] text-muted truncate" title={lang.serverCommand}>
          Command: <code className="text-foreground font-mono">{lang.serverCommand}</code>
        </div>
      )}

      {/* Config file */}
      {lang.configFile && (
        <div className="text-[10px] text-muted truncate" title={lang.configFile}>
          Config: <code className="text-foreground font-mono">{lang.configFile}</code>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hover result display
// ---------------------------------------------------------------------------
function HoverResultView({ hover }: { hover: LspHoverResult }): React.JSX.Element {
  return (
    <div className="p-4 rounded-xl border border-edge bg-surface-alt space-y-2">
      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">Hover Info</h4>
      {hover.signature ? (
        <pre className="text-sm font-mono bg-surface p-3 rounded-lg overflow-x-auto border border-edge whitespace-pre-wrap">
          {hover.signature}
        </pre>
      ) : (
        <p className="text-sm text-muted">No signature available</p>
      )}
      {hover.documentation && (
        <div className="text-xs text-muted whitespace-pre-wrap">{hover.documentation}</div>
      )}
      {hover.language && (
        <span className="text-[10px] text-muted">Language: {hover.language}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Location list (definitions / references)
// ---------------------------------------------------------------------------
function LocationList({ title, locations }: { title: string; locations: LspLocation[] }): React.JSX.Element {
  return (
    <div className="p-4 rounded-xl border border-edge bg-surface-alt space-y-2">
      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">{title} ({locations.length})</h4>
      {locations.length === 0 ? (
        <p className="text-sm text-muted">No results found</p>
      ) : (
        <ul className="space-y-1">
          {locations.map((loc, i) => (
            <li key={`${loc.file}-${loc.startLine}-${loc.startCharacter}-${i}`} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg hover:bg-surface-elevated transition-colors">
              <FileText className="w-3 h-3 text-muted flex-shrink-0" />
              <span className="font-mono text-foreground truncate" title={loc.file}>{loc.file}</span>
              <span className="text-muted flex-shrink-0">:{loc.startLine}:{loc.startCharacter}</span>
              {loc.hint && <span className="text-accent text-[10px] ml-auto truncate">{loc.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// References result with file distribution
// ---------------------------------------------------------------------------
function ReferencesResult({ references }: { references: { total: number; refs: LspLocation[]; byFile: Record<string, number> } }): React.JSX.Element {
  const fileEntries = Object.entries(references.byFile).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-3">
      <LocationList title="References" locations={references.refs} />
      {fileEntries.length > 0 && (
        <div className="p-4 rounded-xl border border-edge bg-surface-alt space-y-2">
          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">By File ({references.total} total)</h4>
          <ul className="space-y-1">
            {fileEntries.map(([file, count]) => (
              <li key={file} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-surface-elevated transition-colors">
                <span className="font-mono truncate text-foreground" title={file}>{file}</span>
                <span className="text-muted flex-shrink-0 ml-2">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diagnostic item
// ---------------------------------------------------------------------------
function DiagnosticItem({ diagnostic }: { diagnostic: LspDiagnostic }): React.JSX.Element {
  const cfg = SEVERITY_CONFIG[diagnostic.severity] ?? SEVERITY_CONFIG[3];
  const Icon = cfg.icon;

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg border border-edge bg-surface-alt hover:shadow-sm transition-shadow">
      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${cfg.color}`} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-muted">{diagnostic.file}:{diagnostic.startLine}:{diagnostic.startCharacter}</span>
          {diagnostic.source && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-elevated text-muted border border-edge">{diagnostic.source}</span>
          )}
          {diagnostic.code && (
            <span className="text-[10px] font-mono text-muted">[{diagnostic.code}]</span>
          )}
        </div>
        <p className="text-sm text-foreground">{diagnostic.message}</p>
      </div>
      <span className={`text-[10px] font-medium flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Symbol tree (recursive)
// ---------------------------------------------------------------------------
const KIND_COLORS: Record<string, string> = {
  Function: "bg-accent/15 text-accent",
  Method: "bg-accent/15 text-accent",
  Class: "bg-warning/15 text-warning",
  Interface: "bg-success/15 text-success",
  Enum: "bg-danger/15 text-danger",
  Variable: "bg-muted/15 text-muted",
  Property: "bg-muted/15 text-muted",
  Constant: "bg-success/15 text-success",
  Module: "bg-warning/15 text-warning",
  Namespace: "bg-warning/15 text-warning",
};

function SymbolTreeItem({ symbol, depth }: { symbol: LspDocumentSymbol; depth: number }): React.JSX.Element {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = symbol.children && symbol.children.length > 0;
  const kindColor = KIND_COLORS[symbol.kind] ?? "bg-muted/10 text-muted";

  return (
    <div>
      <button
        type="button"
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={`flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg hover:bg-surface-elevated transition-colors text-xs ${hasChildren ? "cursor-pointer" : "cursor-default"}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="w-3 h-3 text-muted flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted flex-shrink-0" />
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${kindColor} flex-shrink-0`}>{symbol.kind}</span>
        <span className="font-mono text-foreground truncate">{symbol.name}</span>
        <span className="text-muted ml-auto flex-shrink-0">{symbol.startLine}-{symbol.endLine}</span>
      </button>
      {expanded && hasChildren && symbol.children!.map((child, i) => (
        <SymbolTreeItem key={`${child.name}-${child.startLine}-${i}`} symbol={child as LspDocumentSymbol} depth={depth + 1} />
      ))}
    </div>
  );
}

function SymbolTree({ symbols }: { symbols: LspDocumentSymbol[] }): React.JSX.Element {
  if (symbols.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted">
        <Code className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">No symbols found for this file</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-edge bg-surface-alt overflow-hidden divide-y divide-edge">
      {symbols.map((sym, i) => (
        <SymbolTreeItem key={`${sym.name}-${sym.startLine}-${i}`} symbol={sym} depth={0} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status sub-tab
// ---------------------------------------------------------------------------
function StatusSection({ languages, status }: {
  languages: { detected: LspDetectedLanguage[]; supportedLanguages: string[] };
  status: { bridgeInitialized: boolean; servers: Record<string, string> } | null;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      {/* Bridge status */}
      <div className="flex items-center gap-2 px-4 pt-4">
        <Server className="w-4 h-4 text-muted" />
        <span className="text-xs text-muted">Bridge:</span>
        <span className={`text-xs font-medium ${status?.bridgeInitialized ? "text-success" : "text-warning"}`}>
          {status?.bridgeInitialized ? "Initialized" : "Not initialized"}
        </span>
      </div>

      {/* Language cards */}
      {languages.detected.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted">
          <FileCode className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">No languages detected in this project</p>
          <p className="text-xs mt-1">The LSP bridge will detect languages from project configuration files</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {languages.detected.map((lang) => (
            <LanguageCard
              key={lang.languageId}
              lang={lang}
              serverStatus={status?.servers[lang.languageId]}
            />
          ))}
        </div>
      )}

      {/* Supported languages footer */}
      {languages.supportedLanguages.length > 0 && (
        <div className="px-4 py-2 text-xs text-muted border-t border-edge">
          Supported: {languages.supportedLanguages.join(", ")}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Explorer sub-tab
// ---------------------------------------------------------------------------
function RenameResultView({ edits }: { edits: LspRenameEdit[] }): React.JSX.Element {
  return (
    <div className="p-4 rounded-xl border border-edge bg-surface-alt space-y-2">
      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">Rename Edits ({edits.length})</h4>
      {edits.length === 0 ? (
        <p className="text-sm text-muted">No edits produced — the symbol may not support rename</p>
      ) : (
        <ul className="space-y-1">
          {edits.map((edit, i) => (
            <li key={`${edit.file}-${edit.startLine}-${i}`} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg hover:bg-surface-elevated transition-colors">
              <Pencil className="w-3 h-3 text-warning flex-shrink-0" />
              <span className="font-mono text-foreground truncate" title={edit.file}>{edit.file}</span>
              <span className="text-muted flex-shrink-0">:{edit.startLine}:{edit.startCharacter}</span>
              <span className="text-accent ml-auto text-[10px] truncate">{edit.newText}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExplorerSection({ goToDefinition, findReferences, getHover, rename, operationLoading, definitions, references, hover, renameResult }: {
  goToDefinition: (file: string, line: number, character: number) => Promise<void>;
  findReferences: (file: string, line: number, character: number) => Promise<void>;
  getHover: (file: string, line: number, character: number) => Promise<void>;
  rename: (file: string, line: number, character: number, newName: string) => Promise<void>;
  operationLoading: boolean;
  definitions: LspLocation[];
  references: { total: number; refs: LspLocation[]; byFile: Record<string, number> } | null;
  hover: LspHoverResult | null;
  renameResult: LspRenameEdit[] | null;
}): React.JSX.Element {
  const [file, setFile] = useState("");
  const [line, setLine] = useState("");
  const [col, setCol] = useState("");
  const [newName, setNewName] = useState("");

  const parsedLine = parseInt(line, 10) || 0;
  const parsedCol = parseInt(col, 10) || 0;
  const isValid = file.trim().length > 0 && parsedLine > 0;
  const isRenameValid = isValid && newName.trim().length > 0;

  const handleDefinition = useCallback(() => {
    if (isValid) void goToDefinition(file.trim(), parsedLine, parsedCol);
  }, [file, parsedLine, parsedCol, isValid, goToDefinition]);

  const handleReferences = useCallback(() => {
    if (isValid) void findReferences(file.trim(), parsedLine, parsedCol);
  }, [file, parsedLine, parsedCol, isValid, findReferences]);

  const handleHover = useCallback(() => {
    if (isValid) void getHover(file.trim(), parsedLine, parsedCol);
  }, [file, parsedLine, parsedCol, isValid, getHover]);

  const handleRename = useCallback(() => {
    if (isRenameValid) void rename(file.trim(), parsedLine, parsedCol, newName.trim());
  }, [file, parsedLine, parsedCol, newName, isRenameValid, rename]);

  const hasResults = hover !== null || definitions.length > 0 || references !== null || renameResult !== null;

  return (
    <div className="p-4 space-y-4">
      {/* Input fields */}
      <div className="flex gap-2 flex-wrap">
        <input
          placeholder="File path (e.g. src/main.ts)"
          value={file}
          onChange={(e) => setFile(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-edge rounded-lg bg-surface font-mono focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <input
          placeholder="Line"
          type="number"
          min={1}
          value={line}
          onChange={(e) => setLine(e.target.value)}
          className="w-20 px-3 py-2 text-sm border border-edge rounded-lg bg-surface text-center focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <input
          placeholder="Col"
          type="number"
          min={0}
          value={col}
          onChange={(e) => setCol(e.target.value)}
          className="w-20 px-3 py-2 text-sm border border-edge rounded-lg bg-surface text-center focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleDefinition}
          disabled={!isValid || operationLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Code className="w-3.5 h-3.5" />
          Definition
        </button>
        <button
          type="button"
          onClick={handleReferences}
          disabled={!isValid || operationLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-edge hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          References
        </button>
        <button
          type="button"
          onClick={handleHover}
          disabled={!isValid || operationLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-edge hover:bg-surface-elevated disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          Hover
        </button>
        <div className="flex items-center gap-1.5">
          <input
            placeholder="New name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-32 px-2 py-1.5 text-xs border border-edge rounded-lg bg-surface font-mono focus:outline-none focus:ring-1 focus:ring-warning"
          />
          <button
            type="button"
            onClick={handleRename}
            disabled={!isRenameValid || operationLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-warning text-warning hover:bg-warning/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Rename
          </button>
        </div>
      </div>

      {/* Loading indicator */}
      {operationLoading && (
        <div className="flex items-center gap-2 text-xs text-muted py-2">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Loading...</span>
        </div>
      )}

      {/* Results area */}
      {!operationLoading && hasResults && (
        <div className="space-y-3">
          {hover && <HoverResultView hover={hover} />}
          {definitions.length > 0 && <LocationList title="Definitions" locations={definitions} />}
          {references && <ReferencesResult references={references} />}
          {renameResult && <RenameResultView edits={renameResult} />}
        </div>
      )}

      {/* Empty state */}
      {!operationLoading && !hasResults && (
        <div className="flex flex-col items-center justify-center py-16 text-muted">
          <Search className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">Enter a file path and position to explore symbols</p>
          <p className="text-xs mt-1">Use Definition, References, Hover, or Rename to inspect code</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diagnostics sub-tab
// ---------------------------------------------------------------------------
function DiagnosticsSection({ getDiagnostics, operationLoading, diagnostics }: {
  getDiagnostics: (file: string) => Promise<void>;
  operationLoading: boolean;
  diagnostics: LspDiagnostic[];
}): React.JSX.Element {
  const [file, setFile] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const handleLoad = useCallback(() => {
    if (file.trim()) {
      setHasSearched(true);
      void getDiagnostics(file.trim());
    }
  }, [file, getDiagnostics]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLoad();
  }, [handleLoad]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <input
          placeholder="File path (e.g. src/main.ts)"
          value={file}
          onChange={(e) => setFile(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-2 text-sm border border-edge rounded-lg bg-surface font-mono focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="button"
          onClick={handleLoad}
          disabled={!file.trim() || operationLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Load
        </button>
      </div>

      {/* Loading indicator */}
      {operationLoading && (
        <div className="flex items-center gap-2 text-xs text-muted py-2">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Loading diagnostics...</span>
        </div>
      )}

      {/* Results */}
      {!operationLoading && diagnostics.length > 0 && (
        <div className="space-y-2">
          {diagnostics.map((d, i) => (
            <DiagnosticItem key={`${d.file}-${d.startLine}-${d.startCharacter}-${i}`} diagnostic={d} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!operationLoading && diagnostics.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted">
          <AlertTriangle className="w-10 h-10 mb-3 opacity-40" />
          {hasSearched ? (
            <>
              <p className="text-sm">No diagnostics found for this file</p>
              <p className="text-xs mt-1">The file may be error-free or the language server may not support diagnostics</p>
            </>
          ) : (
            <>
              <p className="text-sm">Enter a file path to load diagnostics</p>
              <p className="text-xs mt-1">View errors, warnings, and hints from the language server</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Symbols sub-tab
// ---------------------------------------------------------------------------
function SymbolsSection({ getSymbols, operationLoading, symbols }: {
  getSymbols: (file: string) => Promise<void>;
  operationLoading: boolean;
  symbols: LspDocumentSymbol[];
}): React.JSX.Element {
  const [file, setFile] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const handleLoad = useCallback(() => {
    if (file.trim()) {
      setHasSearched(true);
      void getSymbols(file.trim());
    }
  }, [file, getSymbols]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLoad();
  }, [handleLoad]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2">
        <input
          placeholder="File path (e.g. src/main.ts)"
          value={file}
          onChange={(e) => setFile(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-2 text-sm border border-edge rounded-lg bg-surface font-mono focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="button"
          onClick={handleLoad}
          disabled={!file.trim() || operationLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent text-white hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <List className="w-3.5 h-3.5" />
          Load
        </button>
      </div>

      {/* Loading indicator */}
      {operationLoading && (
        <div className="flex items-center gap-2 text-xs text-muted py-2">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Loading symbols...</span>
        </div>
      )}

      {/* Results */}
      {!operationLoading && hasSearched && <SymbolTree symbols={symbols} />}

      {/* Empty state (before search) */}
      {!operationLoading && !hasSearched && (
        <div className="flex flex-col items-center justify-center py-16 text-muted">
          <List className="w-10 h-10 mb-3 opacity-40" />
          <p className="text-sm">Enter a file path to explore document symbols</p>
          <p className="text-xs mt-1">View functions, classes, interfaces, and other symbols</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main LSP Tab
// ---------------------------------------------------------------------------
export function LspTab(): React.JSX.Element {
  const {
    languages,
    status,
    loading,
    error,
    operationLoading,
    definitions,
    references,
    hover,
    diagnostics,
    symbols,
    renameResult,
    refresh,
    goToDefinition,
    findReferences,
    getHover,
    getDiagnostics,
    getSymbols,
    rename,
  } = useLsp();

  const [activeSubTab, setActiveSubTab] = useState<SubTab>("status");

  // Error state
  if (error && !languages) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="w-10 h-10 text-danger" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Failed to load LSP data</p>
          <p className="text-xs text-muted mt-1">{error}</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md border border-edge text-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }

  // Loading state
  if (loading || !languages) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header bar skeleton */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-edge bg-surface-alt">
          <div className="flex items-center gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-7 w-28 rounded-lg bg-surface animate-pulse" />
            ))}
          </div>
          <div className="h-7 w-20 rounded-lg bg-surface animate-pulse" />
        </div>
        {/* Content area skeleton (sidebar + main) */}
        <div className="flex-1 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-44 rounded-xl border border-edge bg-surface-alt animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-edge bg-surface-alt">
        <div className="flex items-center gap-1">
          {SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
                  ${isActive
                    ? "bg-accent/10 text-accent"
                    : "text-muted hover:bg-surface-elevated hover:text-foreground"
                  }
                `}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-edge hover:bg-surface-elevated transition-colors"
          title="Refresh LSP data"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 text-xs text-danger bg-danger/5 border-b border-danger/20">
          {error}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {activeSubTab === "status" && (
          <StatusSection languages={languages} status={status} />
        )}
        {activeSubTab === "explorer" && (
          <ExplorerSection
            goToDefinition={goToDefinition}
            findReferences={findReferences}
            getHover={getHover}
            rename={rename}
            operationLoading={operationLoading}
            definitions={definitions}
            references={references}
            hover={hover}
            renameResult={renameResult}
          />
        )}
        {activeSubTab === "diagnostics" && (
          <DiagnosticsSection
            getDiagnostics={getDiagnostics}
            operationLoading={operationLoading}
            diagnostics={diagnostics}
          />
        )}
        {activeSubTab === "symbols" && (
          <SymbolsSection
            getSymbols={getSymbols}
            operationLoading={operationLoading}
            symbols={symbols}
          />
        )}
      </div>
    </div>
  );
}
