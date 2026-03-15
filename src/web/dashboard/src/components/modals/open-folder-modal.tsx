import { useState, useCallback, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import type { BrowseEntry } from "@/lib/types";

interface OpenFolderModalProps {
  open: boolean;
  onClose: () => void;
  onFolderChanged: () => void;
}

export function OpenFolderModal({ open, onClose, onFolderChanged }: OpenFolderModalProps): React.JSX.Element | null {
  const [folderPath, setFolderPath] = useState("");
  const [currentPath, setCurrentPath] = useState("");
  const [recentFolders, setRecentFolders] = useState<string[]>([]);
  const [status, setStatus] = useState<{ type: "info" | "success" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Browse state
  const [browsePath, setBrowsePath] = useState("");
  const [browseEntries, setBrowseEntries] = useState<BrowseEntry[]>([]);
  const [browseParent, setBrowseParent] = useState("");
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState("");
  const [showBrowser, setShowBrowser] = useState(false);

  // Load current folder info when modal opens
  useEffect(() => {
    if (!open) return;
    setStatus(null);
    setFolderPath("");
    setShowBrowser(false);
    setBrowseEntries([]);
    apiClient.getFolder().then((info) => {
      setCurrentPath(info.currentPath);
      setRecentFolders(info.recentFolders);
    }).catch(() => {});
  }, [open]);

  const browseTo = useCallback(async (dirPath: string) => {
    setBrowseLoading(true);
    setBrowseError("");
    try {
      const result = await apiClient.browseFolder(dirPath);
      setBrowsePath(result.path);
      setBrowseParent(result.parent);
      setBrowseEntries(result.entries);
      setShowBrowser(true);
    } catch (err) {
      setBrowseError(err instanceof Error ? err.message : "Failed to browse");
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  const handleSubmit = useCallback(async (pathToOpen?: string) => {
    const target = pathToOpen ?? folderPath.trim();
    if (!target) return;

    setSubmitting(true);
    setStatus({ type: "info", message: "Opening folder..." });

    try {
      const result = await apiClient.openFolder(target);
      if (!result.ok) {
        setStatus({ type: "error", message: result.error ?? "Failed to open folder" });
        return;
      }

      setStatus({ type: "success", message: `Opened: ${result.basePath}` });
      setCurrentPath(result.basePath ?? target);
      if (result.recentFolders) {
        setRecentFolders(result.recentFolders);
      }

      setTimeout(() => {
        onClose();
        onFolderChanged();
      }, 800);
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Failed to open folder" });
    } finally {
      setSubmitting(false);
    }
  }, [folderPath, onClose, onFolderChanged]);

  const handleBrowseOpen = useCallback(() => {
    // Start browsing from current path's parent
    const startPath = currentPath ? currentPath.split("/").slice(0, -1).join("/") || "/" : "/";
    void browseTo(startPath);
  }, [currentPath, browseTo]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--color-bg)] rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Open Folder</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xl">&times;</button>
        </div>

        {/* Current path */}
        <div className="text-xs text-[var(--color-text-muted)] mb-3">
          Current: <span className="font-mono">{currentPath || "..."}</span>
        </div>

        {/* Path input + browse button */}
        <div className="mb-3">
          <label className="block text-sm mb-1">Project folder path</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
              placeholder="/path/to/project"
              className="flex-1 px-3 py-2 text-sm bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded font-mono focus:outline-none focus:border-[var(--color-accent)]"
              autoFocus
            />
            <button
              onClick={() => void handleSubmit()}
              disabled={!folderPath.trim() || submitting}
              className="px-4 py-2 text-sm bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-light)] disabled:opacity-50"
            >
              {submitting ? "..." : "Open"}
            </button>
          </div>
          <button
            onClick={handleBrowseOpen}
            className="mt-1 text-xs text-[var(--color-accent)] hover:underline"
          >
            Browse directories...
          </button>
        </div>

        {/* Status */}
        {status && (
          <div className={`text-sm p-2 rounded mb-3 ${
            status.type === "success" ? "bg-green-500/10 text-green-500" :
            status.type === "error" ? "bg-red-500/10 text-red-500" :
            "bg-blue-500/10 text-blue-500"
          }`}>
            {status.message}
          </div>
        )}

        {/* Directory browser */}
        {showBrowser && (
          <div className="mb-3 border border-[var(--color-border)] rounded overflow-hidden">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1 px-3 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] text-xs font-mono overflow-x-auto whitespace-nowrap">
              {browsePath.split("/").filter(Boolean).map((segment, i, arr) => {
                const segPath = "/" + arr.slice(0, i + 1).join("/");
                return (
                  <span key={segPath} className="flex items-center gap-1">
                    {i > 0 && <span className="text-[var(--color-text-muted)]">/</span>}
                    <button
                      onClick={() => void browseTo(segPath)}
                      className="hover:text-[var(--color-accent)] hover:underline"
                    >
                      {segment}
                    </button>
                  </span>
                );
              })}
            </div>

            {/* Loading */}
            {browseLoading && (
              <div className="px-3 py-4 text-sm text-[var(--color-text-muted)] text-center">Loading...</div>
            )}

            {/* Error */}
            {browseError && (
              <div className="px-3 py-2 text-sm text-red-500">{browseError}</div>
            )}

            {/* Directory list */}
            {!browseLoading && !browseError && (
              <ul className="max-h-48 overflow-y-auto">
                {/* Parent directory */}
                {browseParent && browseParent !== browsePath && (
                  <li>
                    <button
                      onClick={() => void browseTo(browseParent)}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2"
                    >
                      <span className="text-[var(--color-text-muted)]">..</span>
                      <span className="text-xs text-[var(--color-text-muted)]">(parent)</span>
                    </button>
                  </li>
                )}

                {browseEntries.length === 0 && (
                  <li className="px-3 py-2 text-sm text-[var(--color-text-muted)]">No subdirectories</li>
                )}

                {browseEntries.map((entry) => (
                  <li key={entry.path} className="flex items-center">
                    <button
                      onClick={() => void browseTo(entry.path)}
                      className="flex-1 text-left px-3 py-1.5 text-sm hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2 min-w-0"
                    >
                      <span className="shrink-0">{entry.hasGraph ? "📂" : "📁"}</span>
                      <span className={`truncate ${entry.hasGraph ? "font-medium text-[var(--color-accent)]" : ""}`}>
                        {entry.name}
                      </span>
                      {entry.hasGraph && (
                        <span className="shrink-0 text-xs bg-[var(--color-accent)]/20 text-[var(--color-accent)] px-1.5 py-0.5 rounded">
                          graph
                        </span>
                      )}
                    </button>
                    {entry.hasGraph && (
                      <button
                        onClick={() => void handleSubmit(entry.path)}
                        disabled={submitting || entry.path === currentPath}
                        className="shrink-0 mr-2 px-2 py-1 text-xs bg-[var(--color-accent)] text-white rounded hover:bg-[var(--color-accent-light)] disabled:opacity-50"
                      >
                        {entry.path === currentPath ? "current" : "Open"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Recent folders — scrollable area */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {recentFolders.length > 0 && (
            <div className="flex-1 min-h-0 flex flex-col">
              <h3 className="text-sm font-medium mb-2 text-[var(--color-text-muted)] shrink-0">Recent folders</h3>
              <ul className="space-y-1 overflow-y-auto min-h-0">
                {recentFolders.map((folder) => (
                  <li key={folder}>
                    <button
                      onClick={() => void handleSubmit(folder)}
                      disabled={submitting || folder === currentPath}
                      className={`w-full text-left px-3 py-1.5 text-sm font-mono rounded transition-colors ${
                        folder === currentPath
                          ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)] cursor-default"
                          : "hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text)]"
                      }`}
                      title={folder}
                    >
                      <span className="truncate block">{folder}</span>
                      {folder === currentPath && (
                        <span className="text-xs text-[var(--color-accent)]"> (current)</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end mt-4 shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
