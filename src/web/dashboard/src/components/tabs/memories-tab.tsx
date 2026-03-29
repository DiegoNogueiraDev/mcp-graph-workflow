import { useState, useEffect, useCallback, useMemo } from "react";
import { apiClient } from "@/lib/api-client";
import type { ProjectMemory } from "@/lib/types";
import { buildMemoryTree, type MemoryTreeNode } from "@/lib/memory-tree";
import { KnowledgeStorePanel } from "@/components/memories/knowledge-store-panel";
import { KnowledgeExportPanel } from "@/components/memories/knowledge-export-panel";
import { KnowledgeFeedbackPanel } from "@/components/memories/knowledge-feedback-panel";

type MemoriesSubTab = "memories" | "knowledge" | "export";

// ── Main component ───────────────────────────────

export function MemoriesTab(): React.JSX.Element {
  const [subTab, setSubTab] = useState<MemoriesSubTab>("memories");

  return (
    <div className="h-full flex flex-col">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 p-2 border-b border-zinc-700 shrink-0">
        {([
          { id: "memories" as const, label: "Memories" },
          { id: "knowledge" as const, label: "Knowledge Store" },
          { id: "export" as const, label: "Export / Import" },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${subTab === tab.id ? "bg-blue-600/20 text-blue-400" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="flex-1 overflow-y-auto">
        {subTab === "knowledge" && (
          <div className="p-4"><KnowledgeStorePanel /></div>
        )}
        {subTab === "export" && (
          <div className="p-4 space-y-6">
            <KnowledgeExportPanel />
            <div className="border-t border-zinc-700 pt-4">
              <h3 className="text-sm font-semibold text-zinc-200 mb-3">Knowledge Feedback</h3>
              <KnowledgeFeedbackPanel />
            </div>
          </div>
        )}
        {subTab === "memories" && <MemoriesContent />}
      </div>
    </div>
  );
}

// ── Original memories content (extracted to sub-component) ──

function MemoriesContent(): React.JSX.Element {
  const [memories, setMemories] = useState<ProjectMemory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<ProjectMemory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentCache, setContentCache] = useState<Map<string, string>>(new Map());

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const mems = await apiClient.getMemories().catch(() => []);
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

  const handleSelectMemory = useCallback(async (mem: ProjectMemory) => {
    // Set selected immediately (shows name/breadcrumb)
    setSelectedMemory(mem);

    // If content is already cached, use it
    const cached = contentCache.get(mem.name);
    if (cached !== undefined) {
      setSelectedMemory({ ...mem, content: cached });
      return;
    }

    // Lazy-load content
    try {
      setContentLoading(true);
      const fullMemory = await apiClient.readMemory(mem.name);
      setContentCache((prev) => {
        const next = new Map(prev);
        next.set(mem.name, fullMemory.content);
        return next;
      });
      setSelectedMemory({ ...mem, content: fullMemory.content });
    } catch {
      setSelectedMemory({ ...mem, content: "[Failed to load content]" });
    } finally {
      setContentLoading(false);
    }
  }, [contentCache]);

  if (loading) {
    return (
      <div className="h-full flex">
        <div className="w-64 border-r border-edge bg-surface-alt p-2 space-y-2">
          <div className="h-4 w-16 rounded bg-surface animate-pulse" />
          <div className="h-6 w-full rounded bg-surface animate-pulse" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-surface animate-pulse" style={{ width: `${50 + Math.random() * 40}%`, marginLeft: `${(i % 3) * 12}px` }} />
          ))}
        </div>
        <div className="flex-1 flex items-center justify-center text-muted text-xs">
          Loading memories...
        </div>
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

  return (
    <div className="h-full flex flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-edge bg-surface-alt">
        <h2 className="text-sm font-semibold">Memories</h2>

        <StatusBadge
          label="Memories"
          active={memories.length > 0}
        />

        <span className="text-[10px] text-muted">
          {memories.length} memories
        </span>
      </div>

      {/* 2-panel body: left file explorer + right content viewer */}
      <div className="flex flex-1 min-h-0">
        {/* Left: File Explorer */}
        <FileExplorerPanel
          memories={memories}
          selectedMemory={selectedMemory}
          onSelect={handleSelectMemory}
        />

        {/* Right: Memory Content Viewer */}
        <div className="flex-1 min-w-0 overflow-auto">
          <MemoryContentViewer selectedMemory={selectedMemory} contentLoading={contentLoading} />
        </div>
      </div>
    </div>
  );
}

// ── StatusBadge ──────────────────────────────────

function StatusBadge({
  label,
  active,
}: {
  label: string;
  active: boolean;
}): React.JSX.Element {
  const color = active ? "var(--color-success)" : "var(--color-text-muted)";
  const text = active ? "Active" : "No data";

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
  memories: ProjectMemory[];
  selectedMemory: ProjectMemory | null;
  onSelect: (mem: ProjectMemory) => void;
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
      <div className="w-8 border-r border-edge bg-surface-alt flex flex-col items-center pt-2">
        <button
          onClick={() => setCollapsed(false)}
          className="text-[10px] text-muted hover:text-foreground rotate-90"
          title="Expand file explorer"
        >
          Files
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-edge bg-surface-alt flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-edge">
        <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">Files</span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-[10px] text-muted hover:text-foreground"
          title="Collapse"
        >
          ✕
        </button>
      </div>

      <div className="px-2 py-1.5 border-b border-edge">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search files..."
          className="w-full text-[11px] px-2 py-1 rounded bg-surface border border-edge focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex-1 overflow-y-auto text-[11px]">
        {memories.length === 0 ? (
          <div className="px-2 py-4 text-center text-muted">
            No memories
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

// ── TreeNodeList ─────────────────────────────────

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
  selectedMemory: ProjectMemory | null;
  onSelect: (mem: ProjectMemory) => void;
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
              className={`w-full text-left px-2 py-0.5 flex items-center gap-1 hover:bg-surface-elevated transition-colors cursor-pointer ${
                isSelected ? "bg-accent15 text-accent" : "text-foreground"
              }`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {isFolder ? (
                <span className="w-3 text-[9px] text-muted">
                  {isExpanded ? "▾" : "▸"}
                </span>
              ) : (
                <span className="w-3 text-[9px] text-muted">·</span>
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

// ── MemoryContentViewer ──────────────────────────

function MemoryContentViewer({
  selectedMemory,
  contentLoading,
}: {
  selectedMemory: ProjectMemory | null;
  contentLoading: boolean;
}): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  if (!selectedMemory) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        <div className="text-center">
          <p className="text-sm mb-1">Select a memory from the explorer</p>
          <p className="text-xs text-muted/60">Project memories appear as navigable files</p>
        </div>
      </div>
    );
  }

  const handleCopy = (): void => {
    void navigator.clipboard.writeText(selectedMemory.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Build breadcrumb from memory name (e.g., "architecture/design" -> ["architecture", "design"])
  const parts = selectedMemory.name.split("/");

  return (
    <div className="p-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 mb-2 text-[10px] text-muted">
        <span>memories</span>
        {parts.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            <span>/</span>
            <span className={i === parts.length - 1 ? "text-foreground font-medium" : ""}>{part}</span>
          </span>
        ))}
      </div>

      {/* Header with copy */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-edge">
        <span className="text-sm font-semibold">{parts[parts.length - 1]}</span>
        <button
          onClick={handleCopy}
          disabled={contentLoading}
          className={`text-[10px] px-2 py-0.5 rounded border transition-all cursor-pointer ${
            copied
              ? "border-green-500/30 text-green-500 bg-green-500/5"
              : "border-edge text-muted hover:text-foreground"
          }`}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {contentLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-3 rounded bg-surface animate-pulse" style={{ width: `${40 + Math.random() * 50}%` }} />
          ))}
        </div>
      ) : (
        <pre className="text-xs whitespace-pre-wrap text-muted font-mono leading-relaxed">
          {selectedMemory.content}
        </pre>
      )}
    </div>
  );
}
