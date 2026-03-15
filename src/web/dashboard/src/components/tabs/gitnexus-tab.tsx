import { useState, useEffect, useCallback, useMemo } from "react";
import { SigmaContainer, useLoadGraph, useSigma, useRegisterEvents } from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { apiClient } from "@/lib/api-client";
import type { GitNexusStatus, CodeGraphData, ImpactResult } from "@/lib/types";
import { CODE_SYMBOL_COLORS, CODE_RELATION_COLORS } from "@/lib/constants";
import { isCodeGraphData, isImpactResult, isCypherResult, isTabularData } from "@/lib/code-graph-guards";
import { TabularResultView } from "@/components/query-results/tabular-result-view";
import { JsonResultView } from "@/components/query-results/json-result-view";

// Strip existing alpha from hex colors longer than 7 chars (#RRGGBBAA, etc.)
// before appending new alpha. Safari's Canvas2D throws on invalid gradient colors.
function safeColor(color: string, alpha: string): string {
  const base = color.startsWith("#") && color.length > 7 ? color.slice(0, 7) : color;
  return base + alpha;
}

type GitNexusViewMode = "query" | "symbol";

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
  const [gitNexusStatus, setGitNexusStatus] = useState<GitNexusStatus | null>(null);
  const [viewMode, setViewMode] = useState<GitNexusViewMode>("query");
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

  // GitNexus on-demand action
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const status = await apiClient.getGitNexusStatus().catch(() => null);
      setGitNexusStatus(status);

      // Load full code graph if GitNexus is running
      if (status?.running) {
        try {
          const raw = await apiClient.getFullCodeGraph();
          const result = raw as { result?: CypherRow[] };
          if (result.result && Array.isArray(result.result)) {
            const graphData = buildGraphFromCypherRows(result.result);
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

  // Poll while analyze is in progress
  useEffect(() => {
    if (gitNexusStatus?.analyzePhase !== "analyzing") return;
    const interval = setInterval(() => { void loadData(); }, 5000);
    return () => clearInterval(interval);
  }, [gitNexusStatus?.analyzePhase, loadData]);

  const handleQuery = useCallback(async () => {
    if (!queryInput.trim()) return;

    setQueryResult({ data: null, loading: true, error: null });
    try {
      const data = await apiClient.queryCodeGraph(queryInput);
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

  const handleAnalyzeAndStart = useCallback(async () => {
    setActionLoading(true);
    try {
      await apiClient.triggerAnalyze();
      await apiClient.triggerServe();
      await loadData();
    } catch {
      // loadData will refresh status; error state handled by status polling
    } finally {
      setActionLoading(false);
    }
  }, [loadData]);

  const handleSymbolSelect = useCallback((symbolName: string) => {
    setSelectedSymbol(symbolName);
    setSymbolInput(symbolName);
    setViewMode("symbol");
    void handleSymbolContext(symbolName);
  }, [handleSymbolContext]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        Loading GitNexus...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-danger)]">
        Failed to load: {error}
      </div>
    );
  }

  const gitNexusRunning = gitNexusStatus?.running ?? false;
  // Use full graph as base, context graph highlights on top
  const displayGraph = fullGraph ?? contextGraph;

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <h2 className="text-sm font-semibold">GitNexus — Code Intelligence</h2>

        <StatusBadge
          label="GitNexus"
          indexed={gitNexusStatus?.indexed ?? false}
          running={gitNexusRunning}
          onAction={handleAnalyzeAndStart}
          actionLoading={actionLoading}
        />

        {displayGraph && (
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {displayGraph.symbols.length} symbols · {displayGraph.relations.length} relations
          </span>
        )}

        <div className="flex gap-1 ml-auto">
          {(["query", "symbol"] as GitNexusViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                viewMode === mode
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]"
              }`}
            >
              {mode === "query" ? "Query" : "Symbol"}
            </button>
          ))}
        </div>
      </div>

      {/* 2-panel body: left controls/results + right graph */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Query/Symbol panel (~30%) */}
        <div className="w-[30%] min-w-[320px] border-r border-[var(--color-border)] overflow-auto">
          {viewMode === "query" && (
            <QueryContent
              queryInput={queryInput}
              onQueryChange={setQueryInput}
              onSubmit={handleQuery}
              result={queryResult}
              gitNexusRunning={gitNexusRunning}
              onSymbolSelect={handleSymbolSelect}
            />
          )}
          {viewMode === "symbol" && (
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
          )}
        </div>

        {/* Right: Sigma.js Cosmos Graph (~70%) */}
        <CosmosGraphPanel
          fullGraph={displayGraph}
          contextGraph={contextGraph}
          selectedSymbol={selectedSymbol}
          onNodeClick={handleSymbolSelect}
        />
      </div>
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
  const color = running ? "var(--color-success)" : indexed ? "var(--color-warning)" : "var(--color-text-muted)";
  const text = running ? "Active" : indexed ? "Indexed" : "Inactive";
  const showAction = !running && onAction;

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
        style={{ background: `${color}20`, color }}
      >
        {label}: {text}
      </span>
      {showAction && (
        <button
          onClick={onAction}
          disabled={actionLoading}
          className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-accent)] text-white disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {actionLoading ? "Starting..." : "Analyze & Start"}
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
        <div className="mb-4 p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-muted)]">
          GitNexus is not running. Start it to enable code graph queries.
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={queryInput}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="e.g., MATCH (n) RETURN n.name LIMIT 20"
          className="flex-1 text-sm px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
          disabled={!gitNexusRunning}
        />
        <button
          onClick={onSubmit}
          disabled={!gitNexusRunning || result.loading}
          className="text-sm px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {result.loading ? "..." : "Query"}
        </button>
      </div>

      {result.error && (
        <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-danger)]">
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
      <div className="text-xs text-[var(--color-text-muted)] mb-2">
        {symbols.length} symbols found
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]">
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
              className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)] cursor-pointer transition-colors"
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
              <td className="py-1 px-2 text-[var(--color-text-muted)] truncate max-w-[200px]">{sym.file ?? "—"}</td>
              <td className="py-1 px-2 text-[var(--color-text-muted)]">
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
            className="px-2 py-0.5 rounded bg-[var(--color-bg-tertiary)] disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-[var(--color-text-muted)]">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-2 py-0.5 rounded bg-[var(--color-bg-tertiary)] disabled:opacity-30"
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
    <div className="rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold">Impact: {impact.symbol}</span>
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ background: `${riskColor}20`, color: riskColor }}
        >
          {impact.riskLevel} risk
        </span>
      </div>

      <div className="text-xs text-[var(--color-text-muted)] mb-2">
        {impact.affectedSymbols.length} affected symbols
      </div>

      <div className="space-y-1">
        {impact.affectedSymbols.map((sym) => (
          <button
            key={`${sym.name}-${sym.file}`}
            onClick={() => onSymbolSelect(sym.name)}
            className="w-full text-left flex items-center justify-between px-2 py-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors text-xs"
          >
            <span className="font-medium">{sym.name}</span>
            <span className="text-[var(--color-text-muted)] flex items-center gap-2">
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
        <div className="mb-4 p-3 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-text-muted)]">
          GitNexus is not running. Start it to explore symbols.
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={symbolInput}
          onChange={(e) => onSymbolInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onContext(symbolInput)}
          placeholder="e.g., SqliteStore, buildTaskContext"
          className="flex-1 text-sm px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
          disabled={!gitNexusRunning}
        />
        <button
          onClick={() => onContext(symbolInput)}
          disabled={!gitNexusRunning || !symbolInput.trim()}
          className="text-sm px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          Context
        </button>
        <button
          onClick={() => onImpact(symbolInput)}
          disabled={!gitNexusRunning || !symbolInput.trim()}
          className="text-sm px-3 py-2 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          Impact
        </button>
      </div>

      {contextData && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold mb-2 text-[var(--color-text-muted)]">Context — {contextData.symbols.length} symbols</h4>
          <SymbolsTable symbols={contextData.symbols} onSymbolSelect={onSymbolSelect} />
        </div>
      )}

      {impactData && (
        <ImpactCard impact={impactData} onSymbolSelect={onSymbolSelect} />
      )}

      {!contextData && !impactData && (
        <div className="text-center text-[var(--color-text-muted)] text-sm py-8">
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
}: {
  fullGraph: CodeGraphData | null;
  contextGraph: CodeGraphData | null;
  selectedSymbol: string | null;
  onNodeClick: (symbolName: string) => void;
}): React.JSX.Element {
  // Track hovered node for starburst effect
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  if (!fullGraph || fullGraph.symbols.length === 0) {
    return (
      <div className="flex-1 min-w-[300px] flex items-center justify-center" style={{ background: "#06060f" }}>
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
    <div className="flex-1 min-w-[300px] relative" style={{ background: "#06060f" }}>
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
          renderEdgeLabels: false,
          enableEdgeEvents: false,
          defaultEdgeType: "line",
          defaultDrawNodeHover: drawNodeHover,
          defaultDrawNodeLabel: drawNodeLabel,
          minEdgeThickness: 0.3,
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
      const edgeKey = `${rel.from}\0${rel.to}`;
      if (!g.hasNode(rel.from) || !g.hasNode(rel.to) || rel.from === rel.to || seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);
      const baseEdgeColor = CODE_RELATION_COLORS[rel.type] ?? "#2a2a50";
      try {
        g.addEdge(rel.from, rel.to, {
          color: safeColor(baseEdgeColor, "35"),
          size: 0.4,
          baseColor: baseEdgeColor,
          relType: rel.type,
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
        graph.setEdgeAttribute(edge, "color", safeColor(baseEdgeColor, "35"));
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
}: {
  onNodeClick: (name: string) => void;
  onNodeHover: (name: string | null) => void;
  activeNode: string | null;
  highlightedNodes: Set<string>;
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

  // Dynamic starburst on hover via reducers
  useEffect(() => {
    const graph = sigma.getGraph();

    if (activeNode && graph.hasNode(activeNode)) {
      // Build neighbor set for the active node
      const neighbors = new Set<string>(graph.neighbors(activeNode));
      neighbors.add(activeNode);

      sigma.setSetting("nodeReducer", (node, data) => {
        if (node === activeNode) {
          return { ...data, color: "#ffffff", size: (data.size ?? 3) * 1.3, zIndex: 3 };
        }
        if (neighbors.has(node)) {
          const baseColor = graph.getNodeAttribute(node, "baseColor") as string ?? "#6a6a8a";
          return { ...data, color: baseColor.startsWith("#") && baseColor.length > 7 ? baseColor.slice(0, 7) : baseColor, zIndex: 2 };
        }
        if (highlightedNodes.size === 0) {
          // Dim everything else when hovering
          const baseColor = graph.getNodeAttribute(node, "baseColor") as string ?? "#6a6a8a";
          return { ...data, color: safeColor(baseColor, "25"), zIndex: 0 };
        }
        {
          const baseColor = (data.color as string) ?? "#6a6a8a";
          return { ...data, color: baseColor.startsWith("#") && baseColor.length > 7 ? baseColor.slice(0, 7) : baseColor };
        }
      });

      sigma.setSetting("edgeReducer", (edge, data) => {
        const source = graph.source(edge);
        const target = graph.target(edge);
        const isConnected = source === activeNode || target === activeNode;
        if (isConnected) {
          const baseEdgeColor = graph.getEdgeAttribute(edge, "baseColor") as string ?? "#4a4a7a";
          return { ...data, color: safeColor(baseEdgeColor, "f0"), size: 3, zIndex: 2 };
        }
        if (highlightedNodes.size === 0) {
          return { ...data, color: "#0a0a15", size: 0.15, zIndex: 0 };
        }
        return data;
      });
    } else {
      // Clear reducers when nothing is active
      sigma.setSetting("nodeReducer", null);
      sigma.setSetting("edgeReducer", null);
    }
  }, [activeNode, highlightedNodes, sigma]);

  return null;
}
