import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLogs } from "@/hooks/use-logs";
import type { LogEntry, LogLevel } from "@/lib/types";

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: "bg-blue-500/20 text-blue-400",
  warn: "bg-yellow-500/20 text-yellow-400",
  error: "bg-red-500/20 text-red-400",
  success: "bg-green-500/20 text-green-400",
  debug: "bg-gray-500/20 text-gray-400",
};

const ALL_LEVELS: LogLevel[] = ["info", "warn", "error", "success", "debug"];

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("en-US", { hour12: false });
}

function formatContext(ctx?: Record<string, unknown>): string {
  if (!ctx || Object.keys(ctx).length === 0) return "";
  return Object.entries(ctx)
    .map(([k, v]) => `${k}="${String(v)}"`)
    .join(" ");
}

function logsToText(logs: LogEntry[]): string {
  return logs
    .map((entry) => {
      const ctx = formatContext(entry.context);
      return `[${formatTime(entry.timestamp)}] [${entry.level.toUpperCase()}] ${entry.message}${ctx ? " " + ctx : ""}`;
    })
    .join("\n");
}

export function LogsTab(): React.JSX.Element {
  const { logs, loading, clearLogs, refresh } = useLogs();
  const [levelFilter, setLevelFilter] = useState<LogLevel | "all">("all");
  const [searchText, setSearchText] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredLogs = useMemo(() => {
    let result = logs;

    if (levelFilter !== "all") {
      result = result.filter((entry) => entry.level === levelFilter);
    }

    if (searchText.trim()) {
      const term = searchText.toLowerCase();
      result = result.filter((entry) => entry.message.toLowerCase().includes(term));
    }

    return result;
  }, [logs, levelFilter, searchText]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(atBottom);
  }, []);

  const handleCopy = useCallback(async () => {
    const text = logsToText(filteredLogs);
    await navigator.clipboard.writeText(text);
  }, [filteredLogs]);

  const handleDownload = useCallback(() => {
    const text = logsToText(filteredLogs);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mcp-graph-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredLogs]);

  const handleClear = useCallback(async () => {
    await clearLogs();
  }, [clearLogs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        Loading logs...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="logs-tab">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
        {/* Level filter */}
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LogLevel | "all")}
          className="px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]"
          data-testid="log-level-filter"
        >
          <option value="all">All Levels</option>
          {ALL_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </option>
          ))}
        </select>

        {/* Search */}
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search logs..."
          className="flex-1 px-2 py-1 text-sm rounded border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]"
          data-testid="log-search"
        />

        {/* Auto-scroll toggle */}
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={`px-2 py-1 text-xs rounded border ${
            autoScroll
              ? "border-[var(--color-accent)] text-[var(--color-accent)]"
              : "border-[var(--color-border)] text-[var(--color-text-muted)]"
          }`}
          title={autoScroll ? "Auto-scroll enabled" : "Auto-scroll paused"}
        >
          {autoScroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
        </button>

        {/* Action buttons */}
        <button
          onClick={handleCopy}
          className="px-2 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          title="Copy all visible logs"
        >
          Copy
        </button>
        <button
          onClick={handleDownload}
          className="px-2 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          title="Download logs as .txt"
        >
          Download
        </button>
        <button
          onClick={handleClear}
          className="px-2 py-1 text-xs rounded border border-red-500/30 text-red-400 hover:bg-red-500/10"
          title="Clear all logs"
        >
          Clear
        </button>
        <button
          onClick={() => void refresh()}
          className="px-2 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          title="Refresh logs"
        >
          Refresh
        </button>

        {/* Count */}
        <span className="text-xs text-[var(--color-text-muted)]">
          {filteredLogs.length} entries
        </span>
      </div>

      {/* Log list */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto font-mono text-xs p-2"
        data-testid="log-list"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
            No logs to display
          </div>
        ) : (
          filteredLogs.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-2 py-0.5 hover:bg-[var(--color-bg-secondary)]"
            >
              <span className="text-[var(--color-text-muted)] shrink-0">
                {formatTime(entry.timestamp)}
              </span>
              <span
                className={`px-1.5 py-0 rounded text-[10px] font-semibold uppercase shrink-0 ${LEVEL_COLORS[entry.level]}`}
              >
                {entry.level}
              </span>
              <span className="text-[var(--color-text)]">{entry.message}</span>
              {entry.context && Object.keys(entry.context).length > 0 && (
                <span className="text-[var(--color-text-muted)]">
                  {formatContext(entry.context)}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
