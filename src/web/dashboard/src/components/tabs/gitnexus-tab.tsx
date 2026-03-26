import { useState, useEffect, useCallback, useMemo } from "react";
import { SigmaContainer, useLoadGraph, useSigma, useRegisterEvents } from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { apiClient } from "@/lib/api-client";
import type { CodeGraphStatus, CodeGraphData, ImpactResult } from "@/lib/types";
import { CODE_SYMBOL_COLORS, CODE_RELATION_COLORS, CODE_RELATION_LABELS } from "@/lib/constants";
import { isCodeGraphData, isImpactResult, isCypherResult, isTabularData } from "@/lib/code-graph-guards";
import { TabularResultView } from "@/components/query-results/tabular-result-view";
import { JsonResultView } from "@/components/query-results/json-result-view";
import { OpenFolderModal } from "@/components/modals/open-folder-modal";
import { buildFileTree, filterTreeBySearch } from "@/lib/file-tree";
import { FileTreePanel } from "@/components/code-graph/file-tree-panel";
import { GraphFiltersPanel } from "@/components/code-graph/graph-filters-panel";
import { computeNHopNeighbors } from "@/lib/graph-bfs";
import { EdgeArrowProgram, EdgeLineProgram } from "sigma/rendering";

// Strip existing alpha from hex colors longer than 7 chars (#RRGGBBAA, etc.)
// before appending new alpha. Safari's Canvas2D throws on invalid gradient colors.
function safeColor(color: string, alpha: string): string {
  const base = color.startsWith("#") && color.length > 7 ? color.slice(0, 7) : color;
  return base + alpha;
}

type SidebarTab = "explorer" | "filters";

interface QueryResult {
  data: unknown;
  loading: boolean;
  error: string | null;
}

// Node kind mapping from GitNexus _label to our kinds
const LABEL_TO_KIND: Record<string, string> = {
  Function: "function",
  Class: "class",
  Method: "method",
  Interface: "interface",
  Variable: "variable",
  Module: "module",
  File: "file",
  Folder: "folder",
};

// Build CodeGraphData from flat Cypher result rows
interface CypherRow {
  src: string;
  srcFile?: string;
  relType?: string;
  dst: string;
  dstFile?: string;
}

type SymbolKind = "function" | "class" | "method" | "interface" | "variable" | "module" | "file" | "folder";
type RelationType = "imports" | "calls" | "belongs_to" | "extends" | "implements";

const VALID_KINDS = new Set<string>(["function", "class", "method", "interface", "variable", "module", "file", "folder"]);
const VALID_REL_TYPES = new Set<string>(["imports", "calls", "belongs_to", "extends", "implements"]);

function toSymbolKind(kind: string): SymbolKind {
  return VALID_KINDS.has(kind) ? kind as SymbolKind : "module";
}

function toRelationType(type: string): RelationType {
  return VALID_REL_TYPES.has(type) ? type as RelationType : "imports";
}

function buildGraphFromCypherRows(rows: CypherRow[]): CodeGraphData {
  const symbolMap = new Map<string, { name: string; kind: SymbolKind; file?: string }>();
  const relations: Array<{ from: string; to: string; type: RelationType }> = [];

  for (const row of rows) {
    if (row.src && !symbolMap.has(row.src)) {
      symbolMap.set(row.src, {
        name: row.src,
        kind: toSymbolKind(guessKind(row.src)),
        file: row.srcFile ?? undefined,
      });
    }
    if (row.dst && !symbolMap.has(row.dst)) {
      symbolMap.set(row.dst, {
        name: row.dst,
        kind: toSymbolKind(guessKind(row.dst)),
        file: row.dstFile ?? undefined,
      });
    }
    if (row.src && row.dst && row.relType) {
      relations.push({
        from: row.src,
        to: row.dst,
        type: toRelationType(row.relType.toLowerCase()),
      });
    }
  }

  return {
    symbols: Array.from(symbolMap.values()),
    relations,
  };
}

function guessKind(name: string): string {
  if (name.endsWith(".ts") || name.endsWith(".js") || name.endsWith(".tsx")) return "file";
  if (/^[A-Z][a-z]/.test(name) && !name.includes(".")) return "class";
  if (/^[a-z]/.test(name) && !name.includes(".")) return "function";
  return "module";
}

// ── Main component ───────────────────────────────

export function GitNexusTab(): React.JSX.Element {
  const [gitNexusStatus, setGitNexusStatus] = useState<CodeGraphStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  // Query state
  const [queryInput, setQueryInput] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult>({ data: null, loading: false, error: null });

  // Symbol context state
  const [symbolInput, setSymbolInput] = useState("");
  const [symbolContextData, setSymbolContextData] = useState<CodeGraphData | null>(null);
  const [impactData, setImpactData] = useState<ImpactResult | null>(null);

  // Graph data for sigma — full codebase graph + optional context overlay
  const [fullGraph, setFullGraph] = useState<CodeGraphData | null>(null);
  const [contextGraph, setContextGraph] = useState<CodeGraphData | null>(null);

  // Folder modal + current path state
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState<string | null>(null);

  // GitNexus on-demand action
  const [actionLoading, setActionLoading] = useState(false);

  // Sidebar tab (Explorer / Filters)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("explorer");

  // File tree state
  const [fileSearchQuery, setFileSearchQuery] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  // Collapsible sections
  const [queryOpen, setQueryOpen] = useState(false);
  const [symbolOpen, setSymbolOpen] = useState(false);

  // Graph filter state
  const [visibleNodeKinds, setVisibleNodeKinds] = useState<Set<string>>(
    new Set(Object.keys(CODE_SYMBOL_COLORS)),
  );
  const [visibleEdgeTypes, setVisibleEdgeTypes] = useState<Set<string>>(
    new Set(Object.keys(CODE_RELATION_COLORS)),
  );
  const [focusDepth, setFocusDepth] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [status, folderInfo] = await Promise.all([
        apiClient.getCodeGraphStatus().catch(() => null),
        apiClient.getFolder().catch(() => null),
      ]);
      setGitNexusStatus(status);

      // Set current path from folder info or status basePath
      setCurrentPath(folderInfo?.currentPath ?? status?.basePath ?? null);

      // Load full code graph if indexed
      if (status?.indexed) {
        try {
          const graphData = await apiClient.getFullCodeGraph() as CodeGraphData;
          if (graphData?.symbols) {
            setFullGraph(graphData);
          }
        } catch {
          // Full graph load failed — non-blocking
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleQuery = useCallback(async () => {
    if (!queryInput.trim()) return;

    setQueryResult({ data: null, loading: true, error: null });
    try {
      const data = await apiClient.searchCodeGraph(queryInput);
      setQueryResult({ data, loading: false, error: null });
      if (isCodeGraphData(data)) {
        setContextGraph(data);
      }
    } catch (err) {
      setQueryResult({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : "Query failed",
      });
    }
  }, [queryInput]);

  const handleSymbolContext = useCallback(async (symbol: string) => {
    if (!symbol.trim()) return;
    try {
      const data = await apiClient.getSymbolContext(symbol);
      if (isCodeGraphData(data)) {
        setSymbolContextData(data);
        setContextGraph(data);
      }
    } catch {
      // silently handle — user can try again
    }
  }, []);

  const handleSymbolImpact = useCallback(async (symbol: string) => {
    if (!symbol.trim()) return;
    try {
      const data = await apiClient.getSymbolImpact(symbol);
      if (isImpactResult(data)) {
        setImpactData(data);
      }
    } catch {
      // silently handle
    }
  }, []);

  const handleReindex = useCallback(async () => {
    setActionLoading(true);
    try {
      await apiClient.triggerReindex();
      await loadData();
    } catch {
      // loadData will refresh status
    } finally {
      setActionLoading(false);
    }
  }, [loadData]);

  const handleFolderChanged = useCallback(() => {
    void loadData();
  }, [loadData]);

  const handleSymbolSelect = useCallback((symbolName: string) => {
    setSelectedSymbol(symbolName);
    setSymbolInput(symbolName);
    setSymbolOpen(true);
    void handleSymbolContext(symbolName);
  }, [handleSymbolContext]);

  // File tree computed values
  const fileTree = useMemo(() => {
    if (!fullGraph) return [];
    return buildFileTree(fullGraph.symbols);
  }, [fullGraph]);

  const filteredFileTree = useMemo(() => {
    if (!fileSearchQuery.trim()) return fileTree;
    return filterTreeBySearch(fileTree, fileSearchQuery);
  }, [fileTree, fileSearchQuery]);

  const symbolCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (fullGraph) {
      for (const sym of fullGraph.symbols) {
        counts[sym.kind] = (counts[sym.kind] ?? 0) + 1;
      }
    }
    return counts;
  }, [fullGraph]);

  const relationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (fullGraph) {
      for (const rel of fullGraph.relations) {
        counts[rel.type] = (counts[rel.type] ?? 0) + 1;
      }
    }
    return counts;
  }, [fullGraph]);

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleSelectFilePath = useCallback((path: string, isDirectory: boolean) => {
    setSelectedFilePath(path);
    if (!fullGraph) return;

    // Collect symbols from the selected file or folder
    const matchingSymbols = fullGraph.symbols.filter((sym) => {
      if (!sym.file) return false;
      return isDirectory ? sym.file.startsWith(path + "/") || sym.file.startsWith(path) : sym.file === path;
    });

    if (matchingSymbols.length > 0) {
      const contextData: CodeGraphData = {
        symbols: matchingSymbols,
        relations: fullGraph.relations.filter((rel) => {
          const src = rel.from ?? rel.fromSymbol ?? "";
          const dst = rel.to ?? rel.toSymbol ?? "";
          const fromMatch = matchingSymbols.some((s) => s.name === src);
          const toMatch = matchingSymbols.some((s) => s.name === dst);
          return fromMatch || toMatch;
        }),
      };
      setContextGraph(contextData);
    }
  }, [fullGraph]);

  const handleToggleNodeKind = useCallback((kind: string) => {
    setVisibleNodeKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
  }, []);

  const handleToggleEdgeType = useCallback((edgeType: string) => {
    setVisibleEdgeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(edgeType)) {
        next.delete(edgeType);
      } else {
        next.add(edgeType);
      }
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        Loading Code Graph...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-danger">
        Failed to load: {error}
      </div>
    );
  }

  const gitNexusRunning = gitNexusStatus?.indexed ?? false;
  // Use full graph as base, context graph highlights on top
  const displayGraph = fullGraph ?? contextGraph;

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-edge bg-surface-alt">
        <h2 className="text-sm font-semibold">Code Graph — Code Intelligence</h2>

        <StatusBadge
          label="Code Graph"
          indexed={gitNexusStatus?.indexed ?? false}
          running={gitNexusRunning}
          onAction={handleReindex}
          actionLoading={actionLoading}
        />

        {displayGraph && (
          <span className="text-[10px] text-muted">
            {displayGraph.symbols.length} symbols · {displayGraph.relations.length} relations
          </span>
        )}
      </div>

      {/* Path bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-edge bg-surface-alt">
        <span className="text-[10px] text-muted whitespace-nowrap font-mono">
          {currentPath ? `Current: ${currentPath}` : "No project path"}
        </span>
        <button
          onClick={() => setFolderModalOpen(true)}
          className="text-[10px] font-medium px-3 py-1 rounded bg-accent text-white hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          Open Folder...
        </button>
      </div>

      {/* Folder browser modal */}
      <OpenFolderModal
        open={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
        onFolderChanged={handleFolderChanged}
      />

      {/* Warning: TypeScript not available */}
      {gitNexusStatus?.typescriptAvailable === false && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-edge bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
          <span className="text-sm font-medium">TypeScript compiler not found.</span>
          <span className="text-xs">
            Code Graph requires the <code className="font-mono bg-yellow-500/10 px-1 rounded">typescript</code> package to analyze source files.
            Install it: <code className="font-mono bg-yellow-500/10 px-1 rounded">npm install -D typescript</code>
          </span>
        </div>
      )}

      {/* 2-panel body: left controls/results + right graph */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Explorer/Filters sidebar (~30%) */}
        <div className="w-full md:w-[30%] md:min-w-[280px] border-r border-edge flex flex-col min-h-0">
          {/* Sidebar tab bar */}
          <div className="flex border-b border-edge bg-surface-alt">
            {(["explorer", "filters"] as SidebarTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={`flex-1 text-xs px-3 py-2 font-medium transition-colors ${
                  sidebarTab === tab
                    ? "border-b-2 border-accent text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {tab === "explorer" ? "Explorer" : "Filters"}
              </button>
            ))}
          </div>

          {sidebarTab === "explorer" && (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* File tree */}
              <div className="flex-1 min-h-0 overflow-auto">
                <FileTreePanel
                  tree={filteredFileTree}
                  searchQuery={fileSearchQuery}
                  onSearchChange={setFileSearchQuery}
                  expandedPaths={expandedPaths}
                  onToggleExpand={handleToggleExpand}
                  selectedPath={selectedFilePath}
                  onSelectPath={handleSelectFilePath}
                />
              </div>

              {/* Collapsible: Query */}
              <CollapsibleSection title="Query" open={queryOpen} onToggle={() => setQueryOpen((o) => !o)}>
                <QueryContent
                  queryInput={queryInput}
                  onQueryChange={setQueryInput}
                  onSubmit={handleQuery}
                  result={queryResult}
                  gitNexusRunning={gitNexusRunning}
                  onSymbolSelect={handleSymbolSelect}
                />
              </CollapsibleSection>

              {/* Collapsible: Symbol Explorer */}
              <CollapsibleSection title="Symbol Explorer" open={symbolOpen} onToggle={() => setSymbolOpen((o) => !o)}>
                <SymbolContent
                  symbolInput={symbolInput}
                  onSymbolInputChange={setSymbolInput}
                  onContext={handleSymbolContext}
                  onImpact={handleSymbolImpact}
                  contextData={symbolContextData}
                  impactData={impactData}
                  gitNexusRunning={gitNexusRunning}
                  onSymbolSelect={handleSymbolSelect}
                />
              </CollapsibleSection>
            </div>
          )}

          {sidebarTab === "filters" && (
            <GraphFiltersPanel
              visibleNodeKinds={visibleNodeKinds}
              visibleEdgeTypes={visibleEdgeTypes}
              focusDepth={focusDepth}
              onToggleNodeKind={handleToggleNodeKind}
              onToggleEdgeType={handleToggleEdgeType}
              onSetFocusDepth={setFocusDepth}
              symbolCounts={symbolCounts}
              relationCounts={relationCounts}
            />
          )}
        </div>

        {/* Right: Sigma.js Cosmos Graph (~70%) */}
        <CosmosGraphPanel
          fullGraph={displayGraph}
          contextGraph={contextGraph}
          selectedSymbol={selectedSymbol}
          onNodeClick={handleSymbolSelect}
          visibleNodeKinds={visibleNodeKinds}
          visibleEdgeTypes={visibleEdgeTypes}
          focusDepth={focusDepth}
        />
      </div>
    </div>
  );
}

// ── CollapsibleSection ───────────────────────────

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="border-t border-edge">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted hover:text-foreground hover:bg-surface-elevated transition-colors"
      >
        <span className="text-[10px]">{open ? "\u25BE" : "\u25B8"}</span>
        {title}
      </button>
      {open && <div className="max-h-[300px] overflow-auto">{children}</div>}
    </div>
  );
}

// ── StatusBadge ──────────────────────────────────

function StatusBadge({
  label,
  indexed,
  running,
  onAction,
  actionLoading,
}: {
  label: string;
  indexed: boolean;
  running: boolean;
  onAction?: () => void;
  actionLoading?: boolean;
}): React.JSX.Element {
  const color = indexed ? "var(--color-success)" : "var(--color-text-muted)";
  const text = indexed ? `Indexed (${running ? "active" : "ready"})` : "Not indexed";

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
        style={{ background: `${color}20`, color }}
      >
        {label}: {text}
      </span>
      {onAction && (
        <button
          onClick={onAction}
          disabled={actionLoading}
          className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {actionLoading ? "Indexing..." : "Reindex"}
        </button>
      )}
    </span>
  );
}

// ── QueryContent ─────────────────────────────────

function QueryContent({
  queryInput,
  onQueryChange,
  onSubmit,
  result,
  gitNexusRunning,
  onSymbolSelect,
}: {
  queryInput: string;
  onQueryChange: (v: string) => void;
  onSubmit: () => void;
  result: QueryResult;
  gitNexusRunning: boolean;
  onSymbolSelect: (name: string) => void;
}): React.JSX.Element {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold mb-3">Query Code Graph</h3>

      {!gitNexusRunning && (
        <div className="mb-4 p-3 rounded-xl border border-edge shadow-sm hover:shadow-md transition-shadow bg-surface-elevated text-sm text-muted">
          Code index not available. Click Reindex to enable code graph queries.
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={queryInput}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="e.g., MATCH (n) RETURN n.name LIMIT 20"
          className="flex-1 text-sm px-3 py-2 rounded-xl border border-edge shadow-sm hover:shadow-md transition-shadow bg-surface-alt focus:outline-none focus:border-accent"
          disabled={!gitNexusRunning}
        />
        <button
          onClick={onSubmit}
          disabled={!gitNexusRunning || result.loading}
          className="text-sm px-4 py-2 rounded-lg bg-accent text-white font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {result.loading ? "..." : "Query"}
        </button>
      </div>

      {result.error && (
        <div className="p-3 rounded-xl border border-edge shadow-sm hover:shadow-md transition-shadow bg-surface-elevated text-sm text-danger">
          {result.error}
        </div>
      )}

      {result.data != null && (
        <QueryResultRenderer data={result.data} onSymbolSelect={onSymbolSelect} />
      )}
    </div>
  );
}

// ── QueryResultRenderer ──────────────────────────

function QueryResultRenderer({
  data,
  onSymbolSelect,
}: {
  data: unknown;
  onSymbolSelect: (name: string) => void;
}): React.JSX.Element {
  if (isCodeGraphData(data)) {
    return <SymbolsTable symbols={data.symbols} onSymbolSelect={onSymbolSelect} />;
  }

  if (isImpactResult(data)) {
    return <ImpactCard impact={data} onSymbolSelect={onSymbolSelect} />;
  }

  if (isCypherResult(data)) {
    return <TabularResultView data={data.result} />;
  }

  if (isTabularData(data)) {
    return <TabularResultView data={data} />;
  }

  return <JsonResultView data={data} />;
}

// ── SymbolsTable ─────────────────────────────────

function SymbolsTable({
  symbols,
  onSymbolSelect,
}: {
  symbols: Array<{ name: string; kind: string; file?: string; startLine?: number; endLine?: number }>;
  onSymbolSelect: (name: string) => void;
}): React.JSX.Element {
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const totalPages = Math.ceil(symbols.length / pageSize);
  const pageSymbols = symbols.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div>
      <div className="text-xs text-muted mb-2">
        {symbols.length} symbols found
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-edge text-left text-muted">
            <th className="py-1.5 px-2 font-medium">Name</th>
            <th className="py-1.5 px-2 font-medium">Kind</th>
            <th className="py-1.5 px-2 font-medium">File</th>
            <th className="py-1.5 px-2 font-medium">Lines</th>
          </tr>
        </thead>
        <tbody>
          {pageSymbols.map((sym) => (
            <tr
              key={`${sym.name}-${sym.file ?? ""}-${sym.startLine ?? ""}`}
              onClick={() => onSymbolSelect(sym.name)}
              className="border-b border-edge hover:bg-surface-elevated cursor-pointer transition-colors"
            >
              <td className="py-1 px-2 font-medium">{sym.name}</td>
              <td className="py-1 px-2">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    background: `${CODE_SYMBOL_COLORS[sym.kind] ?? "#9e9e9e"}20`,
                    color: CODE_SYMBOL_COLORS[sym.kind] ?? "#9e9e9e",
                  }}
                >
                  {sym.kind}
                </span>
              </td>
              <td className="py-1 px-2 text-muted truncate max-w-[200px]">{sym.file ?? "—"}</td>
              <td className="py-1 px-2 text-muted">
                {sym.startLine != null ? `${sym.startLine}–${sym.endLine ?? sym.startLine}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-2 text-xs">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-2 py-0.5 rounded bg-surface-elevated disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-muted">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-2 py-0.5 rounded bg-surface-elevated disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ── ImpactCard ───────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  low: "#4caf50",
  medium: "#ff9800",
  high: "#f44336",
};

function ImpactCard({
  impact,
  onSymbolSelect,
}: {
  impact: ImpactResult;
  onSymbolSelect: (name: string) => void;
}): React.JSX.Element {
  const riskColor = RISK_COLORS[impact.riskLevel] ?? "#9e9e9e";

  return (
    <div className="rounded-xl border border-edge shadow-sm hover:shadow-md transition-shadow bg-surface-alt p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold">Impact: {impact.symbol}</span>
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: `${riskColor}20`, color: riskColor }}
        >
          {impact.riskLevel} risk
        </span>
      </div>

      <div className="text-xs text-muted mb-2">
        {impact.affectedSymbols.length} affected symbols
      </div>

      <div className="space-y-1">
        {impact.affectedSymbols.map((sym) => (
          <button
            key={`${sym.name}-${sym.file}`}
            onClick={() => onSymbolSelect(sym.name)}
            className="w-full text-left flex items-center justify-between px-2 py-1 rounded hover:bg-surface-elevated transition-colors text-xs"
          >
            <span className="font-medium">{sym.name}</span>
            <span className="text-muted flex items-center gap-2">
              <span className="truncate max-w-[150px]">{sym.file}</span>
              <span>{Math.round(sym.confidence * 100)}%</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── SymbolContent ────────────────────────────────

function SymbolContent({
  symbolInput,
  onSymbolInputChange,
  onContext,
  onImpact,
  contextData,
  impactData,
  gitNexusRunning,
  onSymbolSelect,
}: {
  symbolInput: string;
  onSymbolInputChange: (v: string) => void;
  onContext: (symbol: string) => void;
  onImpact: (symbol: string) => void;
  contextData: CodeGraphData | null;
  impactData: ImpactResult | null;
  gitNexusRunning: boolean;
  onSymbolSelect: (name: string) => void;
}): React.JSX.Element {
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold mb-3">Symbol Explorer</h3>

      {!gitNexusRunning && (
        <div className="mb-4 p-3 rounded-xl border border-edge shadow-sm hover:shadow-md transition-shadow bg-surface-elevated text-sm text-muted">
          Code index not available. Click Reindex to explore symbols.
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={symbolInput}
          onChange={(e) => onSymbolInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onContext(symbolInput)}
          placeholder="e.g., SqliteStore, buildTaskContext"
          className="flex-1 text-sm px-3 py-2 rounded-xl border border-edge shadow-sm hover:shadow-md transition-shadow bg-surface-alt focus:outline-none focus:border-accent"
          disabled={!gitNexusRunning}
        />
        <button
          onClick={() => onContext(symbolInput)}
          disabled={!gitNexusRunning || !symbolInput.trim()}
          className="text-sm px-3 py-2 rounded-lg bg-accent text-white font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          Context
        </button>
        <button
          onClick={() => onImpact(symbolInput)}
          disabled={!gitNexusRunning || !symbolInput.trim()}
          className="text-sm px-3 py-2 rounded-xl border border-edge shadow-sm hover:shadow-md transition-shadow bg-surface-elevated font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          Impact
        </button>
      </div>

      {contextData && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold mb-2 text-muted">Context — {contextData.symbols.length} symbols</h4>
          <SymbolsTable symbols={contextData.symbols} onSymbolSelect={onSymbolSelect} />
        </div>
      )}

      {impactData && (
        <ImpactCard impact={impactData} onSymbolSelect={onSymbolSelect} />
      )}

      {!contextData && !impactData && (
        <div className="text-center text-muted text-sm py-8">
          Enter a symbol name and click Context or Impact to explore
        </div>
      )}
    </div>
  );
}

// ── Cosmos Graph Panel (Sigma.js WebGL) ──────────

function CosmosGraphPanel({
  fullGraph,
  contextGraph,
  selectedSymbol,
  onNodeClick,
  visibleNodeKinds,
  visibleEdgeTypes,
  focusDepth,
}: {
  fullGraph: CodeGraphData | null;
  contextGraph: CodeGraphData | null;
  selectedSymbol: string | null;
  onNodeClick: (symbolName: string) => void;
  visibleNodeKinds: Set<string>;
  visibleEdgeTypes: Set<string>;
  focusDepth: number | null;
}): React.JSX.Element {
  // Track hovered node for starburst effect
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  if (!fullGraph || fullGraph.symbols.length === 0) {
    return (
      <div className="flex-1 min-w-0 flex items-center justify-center" style={{ background: "#06060f" }}>
        <div className="text-center text-[#3a3a5a]">
          <p className="text-sm mb-1">No symbol graph</p>
          <p className="text-xs">Query or select a symbol to see its graph</p>
        </div>
      </div>
    );
  }

  // Build highlighted node set from context graph (memoized to avoid re-renders)
  const highlightedNodes = useMemo(() => {
    const s = new Set<string>();
    if (contextGraph) {
      for (const sym of contextGraph.symbols) s.add(sym.name);
    }
    return s;
  }, [contextGraph]);

  // The "active" node is either hovered or selected — drives starburst
  const activeNode = hoveredNode ?? selectedSymbol;

  return (
    <div className="flex-1 min-w-0 relative" style={{ background: "#06060f" }}>
      {/* Legend — floating translucent */}
      <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1 rounded-lg px-2 py-1.5" style={{ background: "#06060fdd" }}>
        {Object.entries(CODE_SYMBOL_COLORS).map(([kind, color]) => (
          <span
            key={kind}
            className="text-[8px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ background: `${color}20`, color, textShadow: `0 0 8px ${color}` }}
          >
            {kind}
          </span>
        ))}
      </div>

      {/* Node count overlay */}
      <div className="absolute bottom-2 right-2 z-10 text-[9px]" style={{ color: "#3a3a5a" }}>
        {fullGraph.symbols.length} nodes · {fullGraph.relations.length} edges
      </div>

      <SigmaContainer
        style={{ width: "100%", height: "100%", background: "#06060f" }}
        settings={{
          defaultNodeColor: "#3a3a5a",
          defaultEdgeColor: "#151525",
          stagePadding: 40,
          labelColor: { color: "#c0c0e0" },
          labelSize: 11,
          labelFont: "monospace",
          labelWeight: "bold",
          labelRenderedSizeThreshold: 10,
          labelDensity: 0.5,
          renderLabels: true,
          renderEdgeLabels: true,
          enableEdgeEvents: false,
          defaultEdgeType: "arrow",
          edgeProgramClasses: { arrow: EdgeArrowProgram, line: EdgeLineProgram },
          defaultDrawNodeHover: drawNodeHover,
          defaultDrawNodeLabel: drawNodeLabel,
          minEdgeThickness: 0.5,
          minCameraRatio: 0.05,
          maxCameraRatio: 10,
          zIndex: true,
        }}
      >
        <CosmosGraphLoader
          fullGraph={fullGraph}
          highlightedNodes={highlightedNodes}
          selectedSymbol={selectedSymbol}
        />
        <GraphEvents
          onNodeClick={onNodeClick}
          onNodeHover={setHoveredNode}
          activeNode={activeNode}
          highlightedNodes={highlightedNodes}
          visibleNodeKinds={visibleNodeKinds}
          visibleEdgeTypes={visibleEdgeTypes}
          focusDepth={focusDepth}
          selectedSymbol={selectedSymbol}
        />
      </SigmaContainer>
    </div>
  );
}

// Custom label renderer — glowing text like the reference prints
function drawNodeLabel(
  context: CanvasRenderingContext2D,
  data: { x: number; y: number; size: number; color: string; label?: string | null },
  settings: { labelFont: string; labelSize: number; labelWeight: string },
): void {
  const { x, y, size, color, label } = data;
  if (!label) return;

  const fontSize = settings.labelSize;
  context.font = `${settings.labelWeight} ${fontSize}px ${settings.labelFont}`;

  // Glow behind text
  context.shadowColor = color;
  context.shadowBlur = 6;
  context.fillStyle = "#d0d0f0";
  context.fillText(label, x + size * 1.5, y + fontSize / 3);
  context.shadowBlur = 0;
}

// Custom hover renderer — dramatic glow halo + starburst feel
function drawNodeHover(
  context: CanvasRenderingContext2D,
  data: { x: number; y: number; size: number; color: string; label?: string | null },
): void {
  const { x, y, size, color, label } = data;

  // Large outer glow — like a nebula
  const gradient = context.createRadialGradient(x, y, size * 0.5, x, y, size * 6);
  gradient.addColorStop(0, safeColor(color, "80"));
  gradient.addColorStop(0.3, safeColor(color, "30"));
  gradient.addColorStop(0.6, safeColor(color, "10"));
  gradient.addColorStop(1, safeColor(color, "00"));

  context.beginPath();
  context.arc(x, y, size * 6, 0, Math.PI * 2);
  context.fillStyle = gradient;
  context.fill();

  // Bright core
  context.beginPath();
  context.arc(x, y, size * 1.5, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();

  // White-hot center
  context.beginPath();
  context.arc(x, y, size * 0.5, 0, Math.PI * 2);
  context.fillStyle = "#ffffff";
  context.fill();

  // Label with glow
  if (label) {
    context.font = "bold 13px monospace";
    context.shadowColor = color;
    context.shadowBlur = 12;
    context.fillStyle = "#ffffff";
    context.fillText(label, x + size * 2, y + 4);
    context.shadowBlur = 0;
  }
}

function CosmosGraphLoader({
  fullGraph,
  highlightedNodes,
  selectedSymbol,
}: {
  fullGraph: CodeGraphData;
  highlightedNodes: Set<string>;
  selectedSymbol: string | null;
}): null {
  const loadGraph = useLoadGraph();
  const sigma = useSigma();

  useEffect(() => {
    const g = new Graph({ type: "directed", multi: false, allowSelfLoops: false });

    // Add all nodes with base attributes
    for (const sym of fullGraph.symbols) {
      if (!g.hasNode(sym.name)) {
        const baseColor = CODE_SYMBOL_COLORS[sym.kind] ?? "#6a6a8a";

        g.addNode(sym.name, {
          label: sym.name,
          size: 3,
          color: baseColor,
          // Store base color for reducers
          baseColor,
          kind: sym.kind,
          x: Math.random() * 200 - 100,
          y: Math.random() * 200 - 100,
        });
      }
    }

    // Add all edges with type stored for reducers — deduplicate by source→target
    const seenEdges = new Set<string>();
    for (const rel of fullGraph.relations) {
      const source = rel.from ?? rel.fromSymbol ?? "";
      const target = rel.to ?? rel.toSymbol ?? "";
      const edgeKey = `${source}\0${target}`;
      if (!source || !target || !g.hasNode(source) || !g.hasNode(target) || source === target || seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);
      const baseEdgeColor = CODE_RELATION_COLORS[rel.type] ?? "#2a2a50";
      try {
        g.addEdge(source, target, {
          color: safeColor(baseEdgeColor, "a0"),
          size: 0.5,
          baseColor: baseEdgeColor,
          relType: rel.type,
          label: CODE_RELATION_LABELS[rel.type] ?? rel.type,
          type: rel.type === "belongs_to" ? "line" : "arrow",
        });
      } catch {
        // Skip duplicate edges silently
      }
    }

    // ForceAtlas2 layout — organic clustering
    if (g.order > 0) {
      forceAtlas2.assign(g, {
        iterations: g.order > 500 ? 250 : 180,
        settings: {
          gravity: 0.3,
          scalingRatio: g.order > 200 ? 8 : 4,
          barnesHutOptimize: g.order > 50,
          barnesHutTheta: 0.5,
          strongGravityMode: false,
          slowDown: 3,
          adjustSizes: true,
          linLogMode: true, // Better cluster separation
          outboundAttractionDistribution: true,
        },
      });
    }

    loadGraph(g);

    // Degree-based sizing after layout
    const graph = sigma.getGraph();
    graph.forEachNode((node) => {
      const degree = graph.degree(node);
      // Smaller base, bigger range — like real star magnitudes
      const degreeSize = Math.min(10, Math.max(1.5, 1.5 + Math.pow(degree, 0.6) * 0.8));
      graph.setNodeAttribute(node, "size", degreeSize);
    });
  }, [fullGraph, loadGraph, sigma]);

  // Update node appearance when highlights/selection change
  useEffect(() => {
    const graph = sigma.getGraph();
    const hasHighlights = highlightedNodes.size > 0;

    graph.forEachNode((node) => {
      const baseColor = (graph.getNodeAttribute(node, "baseColor") as string) ?? "#6a6a8a";
      const degree = graph.degree(node);
      const isHighlighted = highlightedNodes.has(node);
      const isSelected = node === selectedSymbol;
      const isDimmed = hasHighlights && !isHighlighted;

      // Size
      if (isSelected) {
        graph.setNodeAttribute(node, "size", 14);
        graph.setNodeAttribute(node, "zIndex", 2);
      } else if (isHighlighted) {
        const sz = Math.min(10, Math.max(5, 5 + Math.sqrt(degree) * 1.2));
        graph.setNodeAttribute(node, "size", sz);
        graph.setNodeAttribute(node, "zIndex", 1);
      } else {
        const sz = Math.min(10, Math.max(1.5, 1.5 + Math.pow(degree, 0.6) * 0.8));
        graph.setNodeAttribute(node, "size", sz);
        graph.setNodeAttribute(node, "zIndex", 0);
      }

      // Color
      if (isSelected) {
        graph.setNodeAttribute(node, "color", "#ffffff");
      } else if (isDimmed) {
        graph.setNodeAttribute(node, "color", safeColor(baseColor, "30"));
      } else {
        graph.setNodeAttribute(node, "color", baseColor);
      }
    });

    // Update edges — starburst for selected, highlight for context
    graph.forEachEdge((edge, _attr, source, target) => {
      const baseEdgeColor = (graph.getEdgeAttribute(edge, "baseColor") as string) ?? "#2a2a50";
      const sourceHighlighted = highlightedNodes.has(source);
      const targetHighlighted = highlightedNodes.has(target);
      const isStarburst = selectedSymbol != null && (source === selectedSymbol || target === selectedSymbol);
      const isContextEdge = sourceHighlighted && targetHighlighted;
      const isDimmedEdge = hasHighlights && !isContextEdge && !isStarburst;

      if (isStarburst) {
        // Bright radiating lines from selected node — starburst effect
        graph.setEdgeAttribute(edge, "color", safeColor(baseEdgeColor, "f0"));
        graph.setEdgeAttribute(edge, "size", 3);
        graph.setEdgeAttribute(edge, "zIndex", 2);
      } else if (isContextEdge) {
        graph.setEdgeAttribute(edge, "color", safeColor(baseEdgeColor, "90"));
        graph.setEdgeAttribute(edge, "size", 1.5);
        graph.setEdgeAttribute(edge, "zIndex", 1);
      } else if (isDimmedEdge) {
        graph.setEdgeAttribute(edge, "color", safeColor("#080815", "20"));
        graph.setEdgeAttribute(edge, "size", 0.15);
        graph.setEdgeAttribute(edge, "zIndex", 0);
      } else {
        // Default: faint constellation lines
        graph.setEdgeAttribute(edge, "color", safeColor(baseEdgeColor, "50"));
        graph.setEdgeAttribute(edge, "size", 0.4);
        graph.setEdgeAttribute(edge, "zIndex", 0);
      }
    });

    sigma.refresh();
  }, [highlightedNodes, selectedSymbol, sigma]);

  return null;
}


function GraphEvents({
  onNodeClick,
  onNodeHover,
  activeNode,
  highlightedNodes,
  visibleNodeKinds,
  visibleEdgeTypes,
  focusDepth,
  selectedSymbol,
}: {
  onNodeClick: (name: string) => void;
  onNodeHover: (name: string | null) => void;
  activeNode: string | null;
  highlightedNodes: Set<string>;
  visibleNodeKinds: Set<string>;
  visibleEdgeTypes: Set<string>;
  focusDepth: number | null;
  selectedSymbol: string | null;
}): null {
  const registerEvents = useRegisterEvents();
  const sigma = useSigma();

  useEffect(() => {
    registerEvents({
      clickNode: (event) => {
        onNodeClick(event.node);
      },
      enterNode: (event) => {
        onNodeHover(event.node);
      },
      leaveNode: () => {
        onNodeHover(null);
      },
    });
  }, [registerEvents, onNodeClick, onNodeHover]);

  // Dynamic starburst on hover + filter visibility via reducers
  useEffect(() => {
    const graph = sigma.getGraph();

    // Compute focus depth set if applicable
    let focusSet: Set<string> | null = null;
    if (focusDepth != null && selectedSymbol && graph.hasNode(selectedSymbol)) {
      focusSet = computeNHopNeighbors(graph, selectedSymbol, focusDepth);
    }

    // Always set reducers (for filters even without activeNode)
    sigma.setSetting("nodeReducer", (node, data) => {
      const kind = graph.getNodeAttribute(node, "kind") as string;

      // Filter by node kind
      if (!visibleNodeKinds.has(kind)) {
        return { ...data, hidden: true };
      }

      // Filter by focus depth
      if (focusSet && !focusSet.has(node)) {
        return { ...data, hidden: true };
      }

      // Starburst/hover effects
      if (activeNode && graph.hasNode(activeNode)) {
        const neighbors = new Set<string>(graph.neighbors(activeNode));
        neighbors.add(activeNode);

        if (node === activeNode) {
          return { ...data, color: "#ffffff", size: (data.size ?? 3) * 1.3, zIndex: 3 };
        }
        if (neighbors.has(node)) {
          const baseColor = graph.getNodeAttribute(node, "baseColor") as string ?? "#6a6a8a";
          return { ...data, color: baseColor.startsWith("#") && baseColor.length > 7 ? baseColor.slice(0, 7) : baseColor, zIndex: 2 };
        }
        if (highlightedNodes.size === 0) {
          const baseColor = graph.getNodeAttribute(node, "baseColor") as string ?? "#6a6a8a";
          return { ...data, color: safeColor(baseColor, "25"), zIndex: 0 };
        }
        {
          const baseColor = (data.color as string) ?? "#6a6a8a";
          return { ...data, color: baseColor.startsWith("#") && baseColor.length > 7 ? baseColor.slice(0, 7) : baseColor };
        }
      }

      return data;
    });

    sigma.setSetting("edgeReducer", (edge, data) => {
      const source = graph.source(edge);
      const target = graph.target(edge);
      const relType = graph.getEdgeAttribute(edge, "relType") as string;

      // Filter by edge type
      if (!visibleEdgeTypes.has(relType)) {
        return { ...data, hidden: true };
      }

      // Hide edges connected to hidden nodes
      const sourceKind = graph.getNodeAttribute(source, "kind") as string;
      const targetKind = graph.getNodeAttribute(target, "kind") as string;
      if (!visibleNodeKinds.has(sourceKind) || !visibleNodeKinds.has(targetKind)) {
        return { ...data, hidden: true };
      }

      // Hide edges outside focus depth
      if (focusSet && (!focusSet.has(source) || !focusSet.has(target))) {
        return { ...data, hidden: true };
      }

      // Starburst/hover effects
      if (activeNode && graph.hasNode(activeNode)) {
        const isConnected = source === activeNode || target === activeNode;
        if (isConnected) {
          const baseEdgeColor = graph.getEdgeAttribute(edge, "baseColor") as string ?? "#4a4a7a";
          return { ...data, color: safeColor(baseEdgeColor, "f0"), size: 3, zIndex: 2, forceLabel: true };
        }
        if (highlightedNodes.size === 0) {
          return { ...data, color: "#1e1e3a", size: 0.2, zIndex: 0 };
        }
      }

      return data;
    });
  }, [activeNode, highlightedNodes, visibleNodeKinds, visibleEdgeTypes, focusDepth, selectedSymbol, sigma]);

  return null;
}
