import { memo, useState, useCallback } from "react";
import type { HierarchyTreeNode } from "@/lib/graph-hierarchy";
import { STATUS_COLORS, NODE_TYPE_COLORS } from "@/lib/constants";

interface HierarchyTreePanelProps {
  tree: HierarchyTreeNode[];
  expandedIds: Set<string>;
  selectedNodeId: string | null;
  onToggleExpand: (nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
}

export const HierarchyTreePanel = memo(function HierarchyTreePanel({
  tree,
  expandedIds,
  selectedNodeId,
  onToggleExpand,
  onSelectNode,
}: HierarchyTreePanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const togglePanel = useCallback(() => setCollapsed((c) => !c), []);

  if (collapsed) {
    return (
      <div className="w-8 border-r border-edge bg-surface-alt flex flex-col items-center pt-2">
        <button
          onClick={togglePanel}
          className="text-xs text-muted hover:text-foreground p-1"
          title="Show tree panel"
        >
          ▸
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-edge bg-surface-alt flex flex-col min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-edge">
        <span className="text-xs font-medium text-muted">Hierarchy</span>
        <button
          onClick={togglePanel}
          className="text-xs text-muted hover:text-foreground"
          title="Collapse panel"
        >
          ◂
        </button>
      </div>
      <div className="overflow-y-auto flex-1 py-1">
        {tree.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted text-center">
            No nodes
          </div>
        ) : (
          tree.map((item) => (
            <TreeItem
              key={item.node.id}
              item={item}
              depth={0}
              expandedIds={expandedIds}
              selectedNodeId={selectedNodeId}
              onToggleExpand={onToggleExpand}
              onSelectNode={onSelectNode}
            />
          ))
        )}
      </div>
    </div>
  );
});

interface TreeItemProps {
  item: HierarchyTreeNode;
  depth: number;
  expandedIds: Set<string>;
  selectedNodeId: string | null;
  onToggleExpand: (nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
}

function TreeItem({
  item,
  depth,
  expandedIds,
  selectedNodeId,
  onToggleExpand,
  onSelectNode,
}: TreeItemProps): React.JSX.Element {
  const { node, children } = item;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const hasChildren = children.length > 0;
  const statusColor = STATUS_COLORS[node.status] || "#9e9e9e";
  const typeColor = NODE_TYPE_COLORS[node.type] || "#6c757d";

  const handleChevronClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleExpand(node.id);
    },
    [node.id, onToggleExpand],
  );

  const handleTitleClick = useCallback(() => {
    onSelectNode(node.id);
  }, [node.id, onSelectNode]);

  return (
    <>
      <button
        onClick={handleTitleClick}
        className={`w-full text-left flex items-center gap-1 px-2 py-1 text-xs hover:bg-surface-elevated transition-colors ${
          isSelected ? "bg-surface-elevated font-semibold" : ""
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Chevron */}
        {hasChildren ? (
          <span
            onClick={handleChevronClick}
            className="w-4 text-center text-muted hover:text-foreground cursor-pointer shrink-0"
          >
            {isExpanded ? "\u25BE" : "\u25B8"}
          </span>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Status dot */}
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: statusColor }}
          title={node.status.replace("_", " ")}
        />

        {/* Type badge */}
        <span
          className="text-[9px] px-1 rounded shrink-0"
          style={{ background: `${typeColor}20`, color: typeColor }}
        >
          {node.type.slice(0, 3)}
        </span>

        {/* Title */}
        <span className="truncate">{node.title}</span>

        {/* Child count */}
        {hasChildren && (
          <span className="text-[9px] text-muted ml-auto shrink-0">
            {children.length}
          </span>
        )}
      </button>

      {/* Render children only if expanded */}
      {isExpanded &&
        children.map((child) => (
          <TreeItem
            key={child.node.id}
            item={child}
            depth={depth + 1}
            expandedIds={expandedIds}
            selectedNodeId={selectedNodeId}
            onToggleExpand={onToggleExpand}
            onSelectNode={onSelectNode}
          />
        ))}
    </>
  );
}
