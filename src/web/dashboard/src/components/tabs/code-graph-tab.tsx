import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";
import type { GitNexusStatus, SerenaMemory } from "@/lib/types";
import { CODE_SYMBOL_COLORS } from "@/lib/constants";

type ViewMode = "status" | "memories" | "query";

interface QueryResult {
  data: unknown;
  loading: boolean;
  error: string | null;
}

export function CodeGraphTab(): React.JSX.Element {
  const [gitNexusStatus, setGitNexusStatus] = useState<GitNexusStatus | null>(null);
  const [memories, setMemories] = useState<SerenaMemory[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("status");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Query state
  const [queryInput, setQueryInput] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult>({ data: null, loading: false, error: null });

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

  const handleQuery = useCallback(async () => {
    if (!queryInput.trim()) return;

    setQueryResult({ data: null, loading: true, error: null });
    try {
      const data = await apiClient.queryCodeGraph(queryInput);
      setQueryResult({ data, loading: false, error: null });
    } catch (err) {
      setQueryResult({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : "Query failed",
      });
    }
  }, [queryInput]);

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

        {/* Status badges */}
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

        {/* View mode tabs */}
        <div className="flex gap-1 ml-auto">
          {(["status", "memories", "query"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                viewMode === mode
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)]"
              }`}
            >
              {mode === "status" ? "Overview" : mode === "memories" ? "Codebase" : "Query"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === "status" && (
          <OverviewPanel
            gitNexusStatus={gitNexusStatus}
            memoriesCount={memories.length}
          />
        )}
        {viewMode === "memories" && <MemoriesPanel memories={memories} />}
        {viewMode === "query" && (
          <QueryPanel
            queryInput={queryInput}
            onQueryChange={setQueryInput}
            onSubmit={handleQuery}
            result={queryResult}
            gitNexusRunning={gitNexusStatus?.running ?? false}
          />
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────

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

function OverviewPanel({
  gitNexusStatus,
  memoriesCount,
}: {
  gitNexusStatus: GitNexusStatus | null;
  memoriesCount: number;
}): React.JSX.Element {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* GitNexus Status Card */}
      <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
        <h3 className="text-sm font-semibold mb-2">GitNexus — Code Graph Engine</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="Indexed" value={gitNexusStatus?.indexed ? "Yes" : "No"} />
          <InfoRow label="Running" value={gitNexusStatus?.running ? "Yes" : "No"} />
          <InfoRow label="Port" value={String(gitNexusStatus?.port ?? 3737)} />
          {gitNexusStatus?.url && <InfoRow label="URL" value={gitNexusStatus.url} />}
        </div>
        {!gitNexusStatus?.indexed && (
          <div className="mt-3 p-2 rounded bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-muted)]">
            Run <code className="font-mono bg-[var(--color-bg)] px-1 rounded">gitnexus analyze</code> to index the codebase
          </div>
        )}
      </div>

      {/* Serena Status Card */}
      <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
        <h3 className="text-sm font-semibold mb-2">Serena — Semantic Code Analysis</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoRow label="Memories" value={String(memoriesCount)} />
          <InfoRow label="Status" value={memoriesCount > 0 ? "Active" : "No memories"} />
        </div>
        {memoriesCount === 0 && (
          <div className="mt-3 p-2 rounded bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-muted)]">
            Configure Serena to enable codebase intelligence. Memories are stored in <code className="font-mono bg-[var(--color-bg)] px-1 rounded">.serena/memories/</code>
          </div>
        )}
      </div>

      {/* Symbol Legend */}
      <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
        <h3 className="text-sm font-semibold mb-2">Symbol Types</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CODE_SYMBOL_COLORS).map(([kind, color]) => (
            <span
              key={kind}
              className="text-[10px] font-medium px-2 py-0.5 rounded"
              style={{ background: `${color}20`, color }}
            >
              {kind}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MemoriesPanel({ memories }: { memories: SerenaMemory[] }): React.JSX.Element {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (memories.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        <div className="text-center">
          <p className="text-sm mb-2">No Serena memories found</p>
          <p className="text-xs">Configure Serena for codebase intelligence</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-2">
      <h3 className="text-sm font-semibold mb-3">Codebase Knowledge ({memories.length} memories)</h3>
      {memories.map((mem) => (
        <div
          key={mem.name}
          className="rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] overflow-hidden"
        >
          <button
            onClick={() => setExpanded(expanded === mem.name ? null : mem.name)}
            className="w-full text-left px-4 py-2 flex items-center justify-between hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            <span className="text-sm font-medium">{mem.name}</span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {expanded === mem.name ? "collapse" : "expand"}
            </span>
          </button>
          {expanded === mem.name && (
            <div className="px-4 pb-3 border-t border-[var(--color-border)]">
              <pre className="text-xs whitespace-pre-wrap text-[var(--color-text-muted)] overflow-x-auto mt-2">
                {mem.content}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function QueryPanel({
  queryInput,
  onQueryChange,
  onSubmit,
  result,
  gitNexusRunning,
}: {
  queryInput: string;
  onQueryChange: (v: string) => void;
  onSubmit: () => void;
  result: QueryResult;
  gitNexusRunning: boolean;
}): React.JSX.Element {
  return (
    <div className="max-w-4xl mx-auto">
      <h3 className="text-sm font-semibold mb-3">Query Code Graph</h3>

      {!gitNexusRunning && (
        <div className="mb-4 p-3 rounded-lg bg-[var(--color-warning)]10 border border-[var(--color-warning)]30 text-sm">
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
        <div className="p-3 rounded-lg bg-[var(--color-danger)]10 border border-[var(--color-danger)]30 text-sm text-[var(--color-danger)]">
          {result.error}
        </div>
      )}

      {result.data != null && (
        <div className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
          <pre className="text-xs whitespace-pre-wrap overflow-x-auto">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}
