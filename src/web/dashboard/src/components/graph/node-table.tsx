import { memo, useState, useMemo } from "react";
import type { GraphNode } from "@/lib/types";
import { STATUS_COLORS, NODE_TYPE_COLORS } from "@/lib/constants";

interface NodeTableProps {
  nodes: GraphNode[];
  onNodeClick: (node: GraphNode) => void;
}

type SortKey = "title" | "type" | "status" | "priority" | "xpSize" | "sprint";

const PAGE_SIZE = 50;

export const NodeTable = memo(function NodeTable({ nodes, onNodeClick }: NodeTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!search) return nodes;
    const q = search.toLowerCase();
    return nodes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q) ||
        n.status.toLowerCase().includes(q) ||
        (n.sprint || "").toLowerCase().includes(q),
    );
  }, [nodes, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey] ?? "";
      const vb = b[sortKey] ?? "";
      const cmp = typeof va === "number" ? (va as number) - (vb as number) : String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = useMemo(() => sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [sorted, page]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const headers: Array<{ key: SortKey; label: string }> = [
    { key: "title", label: "Title" },
    { key: "type", label: "Type" },
    { key: "status", label: "Status" },
    { key: "priority", label: "Priority" },
    { key: "xpSize", label: "Size" },
    { key: "sprint", label: "Sprint" },
  ];

  return (
    <div className="border-t border-[var(--color-border)]">
      <div className="px-4 py-2 bg-[var(--color-bg-secondary)]">
        <input
          type="text"
          placeholder="Search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs px-2 py-1 text-sm border border-[var(--color-border)] rounded bg-[var(--color-bg)]"
        />
      </div>
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-bg-tertiary)]">
              {headers.map((h) => (
                <th
                  key={h.key}
                  onClick={() => handleSort(h.key)}
                  className="px-3 py-1.5 text-left text-xs font-medium text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text)]"
                >
                  {h.label}
                  {sortKey === h.key && (sortDir === "asc" ? " ↑" : " ↓")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-[var(--color-text-muted)]">
                  No nodes found
                </td>
              </tr>
            ) : (
              paged.map((node) => (
                <tr
                  key={node.id}
                  onClick={() => onNodeClick(node)}
                  className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] cursor-pointer"
                >
                  <td className="px-3 py-1.5 max-w-[200px] truncate">{node.title}</td>
                  <td className="px-3 py-1.5">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ background: `${NODE_TYPE_COLORS[node.type]}20`, color: NODE_TYPE_COLORS[node.type] }}
                    >
                      {node.type}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: `${STATUS_COLORS[node.status]}20`, color: STATUS_COLORS[node.status] }}
                    >
                      {node.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-center">{node.priority}</td>
                  <td className="px-3 py-1.5 text-center">{node.xpSize || "-"}</td>
                  <td className="px-3 py-1.5">{node.sprint || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
          <span>{sorted.length} nodes</span>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-2 py-0.5 rounded border border-[var(--color-border)] disabled:opacity-30"
            >
              Prev
            </button>
            <span>{page + 1}/{totalPages}</span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="px-2 py-0.5 rounded border border-[var(--color-border)] disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
