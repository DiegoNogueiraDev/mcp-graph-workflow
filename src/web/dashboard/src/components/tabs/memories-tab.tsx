import { useState, useEffect, useCallback, useMemo } from "react";
import { apiClient } from "@/lib/api-client";
import type { ProjectMemory } from "@/lib/types";
import { buildMemoryTree, type MemoryTreeNode } from "@/lib/memory-tree";

// ── Main component ───────────────────────────────

export function MemoriesTab(): React.JSX.Element {
  const [memories, setMemories] = useState<ProjectMemory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<ProjectMemory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        Loading Memories...
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
          onSelect={setSelectedMemory}
        />

        {/* Right: Memory Content Viewer */}
        <div className="flex-1 min-w-0 overflow-auto">
          <MemoryContentViewer selectedMemory={selectedMemory} />
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
              className={`w-full text-left px-2 py-0.5 flex items-center gap-1 hover:bg-surface-elevated transition-colors ${
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

function MemoryContentViewer({ selectedMemory }: { selectedMemory: ProjectMemory | null }): React.JSX.Element {
  if (!selectedMemory) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        <div className="text-center">
          <p className="text-sm mb-1">Select a memory from the explorer</p>
          <p className="text-xs">Project memories appear as navigable files</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-edge">
        <span className="text-sm font-semibold">{selectedMemory.name}</span>
      </div>
      <pre className="text-xs whitespace-pre-wrap text-muted font-mono leading-relaxed">
        {selectedMemory.content}
      </pre>
    </div>
  );
}
