import { memo, useCallback } from "react";
import type { FileTreeNode } from "@/lib/file-tree";
import { CODE_SYMBOL_COLORS } from "@/lib/constants";

interface FileTreePanelProps {
  tree: FileTreeNode[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  selectedPath: string | null;
  onSelectPath: (path: string, isDirectory: boolean) => void;
}

export const FileTreePanel = memo(function FileTreePanel({
  tree,
  searchQuery,
  onSearchChange,
  expandedPaths,
  onToggleExpand,
  selectedPath,
  onSelectPath,
}: FileTreePanelProps) {
  return (
    <div className="flex flex-col min-h-0">
      {/* Search input */}
      <div className="px-3 py-2 border-b border-edge">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search files..."
          className="w-full text-xs px-2 py-1.5 rounded bg-surface border border-edge focus:outline-none focus:border-accent"
        />
      </div>

      {/* Tree */}
      <div className="overflow-y-auto flex-1 py-1">
        {tree.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted text-center">
            {searchQuery ? "No files match" : "No files indexed"}
          </div>
        ) : (
          tree.map((item) => (
            <FileTreeItem
              key={item.path}
              item={item}
              depth={0}
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              onToggleExpand={onToggleExpand}
              onSelectPath={onSelectPath}
            />
          ))
        )}
      </div>
    </div>
  );
});

interface FileTreeItemProps {
  item: FileTreeNode;
  depth: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  onToggleExpand: (path: string) => void;
  onSelectPath: (path: string, isDirectory: boolean) => void;
}

function FileTreeItem({
  item,
  depth,
  expandedPaths,
  selectedPath,
  onToggleExpand,
  onSelectPath,
}: FileTreeItemProps): React.JSX.Element {
  const isExpanded = expandedPaths.has(item.path);
  const isSelected = selectedPath === item.path;
  const hasChildren = item.children.length > 0;

  const iconColor = item.isDirectory
    ? CODE_SYMBOL_COLORS["folder"] ?? "#78909c"
    : CODE_SYMBOL_COLORS["file"] ?? "#90a4ae";

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleExpand(item.path);
    },
    [item.path, onToggleExpand],
  );

  const handleClick = useCallback(() => {
    if (item.isDirectory) {
      onToggleExpand(item.path);
    }
    onSelectPath(item.path, item.isDirectory);
  }, [item.path, item.isDirectory, onToggleExpand, onSelectPath]);

  return (
    <>
      <button
        onClick={handleClick}
        className={`w-full text-left flex items-center gap-1.5 px-2 py-0.5 text-xs hover:bg-surface-elevated transition-colors ${
          isSelected ? "bg-surface-elevated font-semibold" : ""
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {/* Chevron */}
        {hasChildren || item.isDirectory ? (
          <span
            onClick={handleChevronClick}
            className="w-3 text-center text-muted hover:text-foreground cursor-pointer shrink-0 text-[10px]"
          >
            {isExpanded ? "\u25BE" : "\u25B8"}
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Icon */}
        <span style={{ color: iconColor }} className="shrink-0 text-[10px]">
          {item.isDirectory ? "\u{1F4C1}" : "\u{1F4C4}"}
        </span>

        {/* Name */}
        <span className="truncate" style={{ color: iconColor }}>
          {item.name}
        </span>

        {/* Symbol count */}
        {item.symbolCount > 0 && (
          <span className="text-[9px] text-muted ml-auto shrink-0">
            {item.symbolCount}
          </span>
        )}
      </button>

      {/* Children */}
      {isExpanded &&
        item.children.map((child) => (
          <FileTreeItem
            key={child.path}
            item={child}
            depth={depth + 1}
            expandedPaths={expandedPaths}
            selectedPath={selectedPath}
            onToggleExpand={onToggleExpand}
            onSelectPath={onSelectPath}
          />
        ))}
    </>
  );
}
