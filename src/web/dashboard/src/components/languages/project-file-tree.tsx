import { useState, useMemo, memo, useCallback } from "react";
import { ChevronRight, ChevronDown, FileCode, Folder, Search } from "lucide-react";
import type { TranslationProjectFile } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectFileTreeProps {
  files: TranslationProjectFile[];
  selectedFileId: string | null;
  onSelectFile: (fileId: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  file?: TranslationProjectFile;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_DOTS: Record<string, string> = {
  done: "bg-green-500",
  analyzed: "bg-yellow-500",
  translating: "bg-blue-500",
  analyzing: "bg-blue-500",
  failed: "bg-red-500",
  pending: "bg-gray-500",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildTree(files: TranslationProjectFile[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", isDir: true, children: [] };

  for (const file of files) {
    const parts = file.filePath.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const partPath = parts.slice(0, i + 1).join("/");

      if (isLast) {
        current.children.push({
          name: part,
          path: partPath,
          isDir: false,
          children: [],
          file,
        });
      } else {
        let dir = current.children.find((c) => c.isDir && c.name === part);
        if (!dir) {
          dir = { name: part, path: partPath, isDir: true, children: [] };
          current.children.push(dir);
        }
        current = dir;
      }
    }
  }

  // Sort: directories first, then alphabetically
  const sortChildren = (nodes: TreeNode[]): TreeNode[] => {
    const sorted = [...nodes].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of sorted) {
      if (node.isDir) {
        node.children = sortChildren(node.children);
      }
    }
    return sorted;
  };

  return sortChildren(root.children);
}

function countByStatus(files: TranslationProjectFile[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of files) {
    counts[f.status] = (counts[f.status] ?? 0) + 1;
  }
  return counts;
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const lower = query.toLowerCase();
  const result: TreeNode[] = [];

  for (const node of nodes) {
    if (node.isDir) {
      const filteredChildren = filterTree(node.children, query);
      if (filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren });
      }
    } else if (node.path.toLowerCase().includes(lower)) {
      result.push(node);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Tree item (memoized)
// ---------------------------------------------------------------------------

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  selectedFileId: string | null;
  onSelectFile: (fileId: string) => void;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
}

const TreeItem = memo(function TreeItem({
  node,
  depth,
  selectedFileId,
  onSelectFile,
  expandedPaths,
  onToggle,
}: TreeItemProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = !node.isDir && node.file?.id === selectedFileId;
  const paddingLeft = depth * 16 + 8;

  if (node.isDir) {
    return (
      <div style={{ contentVisibility: "auto" }}>
        <button
          type="button"
          className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-sm text-muted hover:bg-surface-hover"
          style={{ paddingLeft }}
          onClick={() => onToggle(node.path)}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
          <Folder className="h-3.5 w-3.5 shrink-0 text-yellow-500/80" />
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded &&
          node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFileId={selectedFileId}
              onSelectFile={onSelectFile}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
            />
          ))}
      </div>
    );
  }

  const status = node.file?.status ?? "pending";
  const confidence = node.file?.confidenceScore;
  const dotColor = STATUS_DOTS[status] ?? STATUS_DOTS.pending;

  return (
    <button
      type="button"
      className={`
        flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-sm transition-colors
        ${isSelected ? "bg-accent/10 border border-accent text-foreground" : "text-muted hover:bg-surface-hover border border-transparent"}
      `}
      style={{ paddingLeft, contentVisibility: "auto" }}
      onClick={() => node.file && onSelectFile(node.file.id)}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
      <FileCode className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{node.name}</span>
      {confidence != null && (
        <span className="ml-auto shrink-0 text-xs text-muted">
          {Math.round(confidence * 100)}%
        </span>
      )}
    </button>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProjectFileTree({ files, selectedFileId, onSelectFile }: ProjectFileTreeProps) {
  const [search, setSearch] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildTree(files), [files]);

  const visibleTree = useMemo(() => {
    if (!search.trim()) return tree;
    return filterTree(tree, search.trim());
  }, [tree, search]);

  const statusCounts = useMemo(() => countByStatus(files), [files]);

  const handleToggle = useCallback((path: string) => {
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

  const readyCount = (statusCounts.done ?? 0) + (statusCounts.analyzed ?? 0);
  const needAiCount = statusCounts.translating ?? 0;
  const errorCount = statusCounts.failed ?? 0;

  return (
    <div className="flex flex-col gap-2">
      {/* Summary */}
      <div className="text-xs text-muted px-1">
        {files.length} files: {readyCount} ready, {needAiCount} need AI, {errorCount} error
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Filter files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded border border-edge bg-surface py-1 pl-7 pr-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      {/* Tree */}
      <div className="overflow-y-auto max-h-[60vh]">
        {visibleTree.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            depth={0}
            selectedFileId={selectedFileId}
            onSelectFile={onSelectFile}
            expandedPaths={expandedPaths}
            onToggle={handleToggle}
          />
        ))}
        {visibleTree.length === 0 && (
          <div className="py-4 text-center text-xs text-muted">No files match your filter</div>
        )}
      </div>
    </div>
  );
}
