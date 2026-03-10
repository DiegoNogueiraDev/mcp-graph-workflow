import { useState, useEffect, useCallback, useMemo } from "react";
import { SigmaContainer, useLoadGraph, useSigma, useRegisterEvents } from "@react-sigma/core";
import "@react-sigma/core/lib/style.css";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { apiClient } from "@/lib/api-client";
import type { GitNexusStatus, SerenaMemory, CodeGraphData, ImpactResult } from "@/lib/types";
import { CODE_SYMBOL_COLORS, CODE_RELATION_COLORS } from "@/lib/constants";
import { isCodeGraphData, isImpactResult } from "@/lib/code-graph-guards";
import { buildMemoryTree, type MemoryTreeNode } from "@/lib/memory-tree";

type ViewMode = "explorer" | "query" | "symbol";

interface QueryResult {
  data: unknown;
  loading: boolean;
  error: string | null;
}

// ── Main component ───────────────────────────────

export function CodeGraphTab(): React.JSX.Element {
  const [gitNexusStatus, setGitNexusStatus] = useState<GitNexusStatus | null>(null);
  const [memories, setMemories] = useState<SerenaMemory[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("explorer");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedMemory, setSelectedMemory] = useState<SerenaMemory | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  // Query state
  const [queryInput, setQueryInput] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult>({ data: null, loading: false, error: null });

  // Symbol context state
  const [symbolInput, setSymbolInput] = useState("");
  const [symbolContextData, setSymbolContextData] = useState<CodeGraphData | null>(null);
  const [impactData, setImpactData] = useState<ImpactResult | null>(null);

  // Graph data for sigma (from queries or symbol context)
  const [graphData, setGraphData] = useState<CodeGraphData | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [status, mems] = await Promise.all([
        apiClient.getGitNexusStatus().catch(() => null),
        apiClient.getSerenaMemories().catch(() => []),
      ]);

      setGitNexusStatus(status);
      setMemories(mems);
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
        setGraphData(data);
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
        setGraphData(data);
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

  const handleSymbolSelect = useCallback((symbolName: string) => {
    setSelectedSymbol(symbolName);
    setSymbolInput(symbolName);
    void handleSymbolContext(symbolName);
  }, [handleSymbolContext]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        Loading Code Intelligence...
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

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        <h2 className="text-sm font-semibold">Code Intelligence</h2>

        <StatusBadge
          label="GitNexus"
          indexed={gitNexusStatus?.indexed ?? false}
          running={gitNexusStatus?.running ?? false}
        />
        <StatusBadge
          label="Serena"
          indexed={memories.length > 0}
          running={memories.length > 0}
        />

        {graphData && (
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {graphData.symbols.length} symbols · {graphData.relations.length} relations
          </span>
        )}

        <div className="flex gap-1 ml-auto">
          {(["explorer", "query", "symbol"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                viewMode === mode
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]"
              }`}
            >
              {mode === "explorer" ? "Explorer" : mode === "query" ? "Query" : "Symbol"}
            </button>
          ))}
        </div>
      </div>

      {/* 3-panel body */}
      <div className="flex flex-1 min-h-0">
        {/* Left: File Explorer */}
        <FileExplorerPanel
          memories={memories}
          selectedMemory={selectedMemory}
          onSelect={(mem) => {
            setSelectedMemory(mem);
            setViewMode("explorer");
          }}
        />

        {/* Center: Content panel */}
        <div className="flex-1 min-w-0 border-r border-[var(--color-border)] overflow-auto">
          {viewMode === "explorer" && (
            <ExplorerContent selectedMemory={selectedMemory} />
          )}
          {viewMode === "query" && (
            <QueryContent
              queryInput={queryInput}
              onQueryChange={setQueryInput}
              onSubmit={handleQuery}
              result={queryResult}
              gitNexusRunning={gitNexusStatus?.running ?? false}
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
              gitNexusRunning={gitNexusStatus?.running ?? false}
              onSymbolSelect={handleSymbolSelect}
            />
          )}
        </div>

        {/* Right: Symbol graph */}
        <SymbolGraphPanel
          graphData={graphData}
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
}: {
  label: string;
  indexed: boolean;
  running: boolean;
}): React.JSX.Element {
  const color = running ? "var(--color-success)" : indexed ? "var(--color-warning)" : "var(--color-text-muted)";
  const text = running ? "Active" : indexed ? "Indexed" : "Inactive";

  return (
    <span
      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
      style={{ background: `${color}20`, color }}
    >
      {label}: {text}
    </span>
  );
}

// ── FileExplorerPanel ────────────────────────────

function FileExplorerPanel({
  memories,
  selectedMemory,
  onSelect,
}: {
  memories: SerenaMemory[];
  selectedMemory: SerenaMemory | null;
  onSelect: (mem: SerenaMemory) => void;
}): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const filteredMemories = useMemo(() => {
    if (!search.trim()) return memories;
    const q = search.toLowerCase();
    return memories.filter((m) => m.name.toLowerCase().includes(q));
  }, [memories, search]);

  const tree = useMemo(() => buildMemoryTree(filteredMemories), [filteredMemories]);

  const togglePath = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  if (collapsed) {
    return (
      <div className="w-8 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col items-center pt-2">
        <button
          onClick={() => setCollapsed(false)}
          className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] rotate-90"
          title="Expand file explorer"
        >
          Files
        </button>
      </div>
    );
  }

  return (
    <div className="w-56 border-r border-[var(--color-border)] bg-[var(--color-bg-secondary)] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--color-border)]">
        <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Files</span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          title="Collapse"
        >
          ✕
        </button>
      </div>

      <div className="px-2 py-1.5 border-b border-[var(--color-border)]">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files..."
          className="w-full text-[11px] px-2 py-1 rounded bg-[var(--color-bg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      <div className="flex-1 overflow-y-auto text-[11px]">
        {memories.length === 0 ? (
          <div className="px-2 py-4 text-center text-[var(--color-text-muted)]">
            No Serena memories
          </div>
        ) : (
          <TreeNodeList
            nodes={tree}
            depth={0}
            expandedPaths={expandedPaths}
            onToggle={togglePath}
            selectedMemory={selectedMemory}
            onSelect={onSelect}
          />
        )}
      </div>
    </div>
  );
}

function TreeNodeList({
  nodes,
  depth,
  expandedPaths,
  onToggle,
  selectedMemory,
  onSelect,
}: {
  nodes: MemoryTreeNode[];
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  selectedMemory: SerenaMemory | null;
  onSelect: (mem: SerenaMemory) => void;
}): React.JSX.Element {
  return (
    <>
      {nodes.map((node) => {
        const isFolder = node.children.length > 0;
        const isExpanded = expandedPaths.has(node.path);
        const isSelected = node.memory != null && selectedMemory?.name === node.memory.name;

        return (
          <div key={node.path}>
            <button
              onClick={() => {
                if (isFolder) onToggle(node.path);
                if (node.memory) onSelect(node.memory);
              }}
              className={`w-full text-left px-2 py-0.5 flex items-center gap-1 hover:bg-[var(--color-bg-tertiary)] transition-colors ${
                isSelected ? "bg-[var(--color-accent)]15 text-[var(--color-accent)]" : "text-[var(--color-text)]"
              }`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {isFolder ? (
                <span className="w-3 text-[9px] text-[var(--color-text-muted)]">
                  {isExpanded ? "▾" : "▸"}
                </span>
              ) : (
                <span className="w-3 text-[9px] text-[var(--color-text-muted)]">·</span>
              )}
              <span className="truncate">{node.name}</span>
            </button>
            {isFolder && isExpanded && (
              <TreeNodeList
                nodes={node.children}
                depth={depth + 1}
                expandedPaths={expandedPaths}
                onToggle={onToggle}
                selectedMemory={selectedMemory}
                onSelect={onSelect}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

// ── ExplorerContent ──────────────────────────────

function ExplorerContent({ selectedMemory }: { selectedMemory: SerenaMemory | null }): React.JSX.Element {
  if (!selectedMemory) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        <div className="text-center">
          <p className="text-sm mb-1">Select a file from the explorer</p>
          <p className="text-xs">Serena memories appear as navigable files</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[var(--color-border)]">
        <span className="text-sm font-semibold">{selectedMemory.name}</span>
      </div>
      <pre className="text-xs whitespace-pre-wrap text-[var(--color-text-muted)] font-mono leading-relaxed">
        {selectedMemory.content}
      </pre>
    </div>
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
          placeholder="e.g., find all functions in GraphStore"
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

  return (
    <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
      <pre className="text-xs whitespace-pre-wrap overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
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

// ── SymbolGraphPanel (Sigma.js WebGL) ────────────

function SymbolGraphPanel({
  graphData,
  selectedSymbol,
  onNodeClick,
}: {
  graphData: CodeGraphData | null;
  selectedSymbol: string | null;
  onNodeClick: (symbolName: string) => void;
}): React.JSX.Element {
  if (!graphData || graphData.symbols.length === 0) {
    return (
      <div className="flex-1 min-w-[300px] bg-[#0d1117] flex items-center justify-center">
        <div className="text-center text-[#8b949e]">
          <p className="text-sm mb-1">No symbol graph</p>
          <p className="text-xs">Query or select a symbol to see its graph</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-[300px] bg-[#0d1117] relative">
      {/* Legend */}
      <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1">
        {Object.entries(CODE_SYMBOL_COLORS).map(([kind, color]) => (
          <span
            key={kind}
            className="text-[9px] font-medium px-1.5 py-0.5 rounded"
            style={{ background: `${color}30`, color }}
          >
            {kind}
          </span>
        ))}
      </div>

      <SigmaContainer
        style={{ width: "100%", height: "100%" }}
        settings={{
          defaultNodeColor: "#9e9e9e",
          defaultEdgeColor: "#6c757d",
          labelColor: { color: "#c9d1d9" },
          labelSize: 10,
          labelRenderedSizeThreshold: 8,
          renderLabels: true,
          renderEdgeLabels: false,
          enableEdgeEvents: false,
        }}
      >
        <GraphLoader graphData={graphData} selectedSymbol={selectedSymbol} />
        <GraphEvents onNodeClick={onNodeClick} />
      </SigmaContainer>
    </div>
  );
}

function GraphLoader({
  graphData,
  selectedSymbol,
}: {
  graphData: CodeGraphData;
  selectedSymbol: string | null;
}): null {
  const loadGraph = useLoadGraph();
  const sigma = useSigma();

  useEffect(() => {
    const g = new Graph();

    for (const sym of graphData.symbols) {
      if (!g.hasNode(sym.name)) {
        g.addNode(sym.name, {
          label: sym.name,
          size: 8,
          color: CODE_SYMBOL_COLORS[sym.kind] ?? "#9e9e9e",
          x: Math.random() * 100,
          y: Math.random() * 100,
        });
      }
    }

    for (const rel of graphData.relations) {
      if (g.hasNode(rel.from) && g.hasNode(rel.to) && !g.hasEdge(rel.from, rel.to)) {
        g.addEdge(rel.from, rel.to, {
          color: CODE_RELATION_COLORS[rel.type] ?? "#6c757d",
          size: 1,
        });
      }
    }

    // Apply ForceAtlas2 layout synchronously
    if (g.order > 0) {
      forceAtlas2.assign(g, {
        iterations: 100,
        settings: {
          gravity: 1,
          scalingRatio: 2,
          barnesHutOptimize: g.order > 100,
        },
      });
    }

    loadGraph(g);

    // Highlight selected node
    if (selectedSymbol && g.hasNode(selectedSymbol)) {
      sigma.getGraph().setNodeAttribute(selectedSymbol, "size", 14);
      sigma.getGraph().setNodeAttribute(selectedSymbol, "highlighted", true);
    }
  }, [graphData, selectedSymbol, loadGraph, sigma]);

  return null;
}

function GraphEvents({ onNodeClick }: { onNodeClick: (name: string) => void }): null {
  const registerEvents = useRegisterEvents();

  useEffect(() => {
    registerEvents({
      clickNode: (event) => {
        onNodeClick(event.node);
      },
    });
  }, [registerEvents, onNodeClick]);

  return null;
}
