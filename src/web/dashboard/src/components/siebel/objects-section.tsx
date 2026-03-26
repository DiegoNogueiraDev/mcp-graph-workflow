/**
 * ObjectsSection — Filtered table of indexed Siebel objects.
 */

import { useState, useMemo, useDeferredValue } from "react";
import type { SiebelObject } from "@/hooks/use-siebel-data";
import { SIEBEL_TYPE_COLORS } from "@/lib/constants";

interface ObjectsSectionProps {
  objects: SiebelObject[];
}

const ROW_HEIGHT = 36;
const VISIBLE_ROWS = 15;

export function ObjectsSection({ objects }: ObjectsSectionProps): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const deferredSearch = useDeferredValue(search);
  const deferredTypeFilter = useDeferredValue(typeFilter);

  const allTypes = useMemo(() => {
    const types = new Set<string>();
    for (const obj of objects) {
      if (obj.siebelType) types.add(obj.siebelType);
    }
    return [...types].sort();
  }, [objects]);

  const filtered = useMemo(() => {
    let result = objects;
    if (deferredSearch) {
      const q = deferredSearch.toLowerCase();
      result = result.filter(
        (obj) =>
          obj.title.toLowerCase().includes(q) ||
          obj.siebelProject?.toLowerCase().includes(q) ||
          obj.contentPreview.toLowerCase().includes(q),
      );
    }
    if (deferredTypeFilter.size > 0) {
      result = result.filter((obj) => obj.siebelType && deferredTypeFilter.has(obj.siebelType));
    }
    return result;
  }, [objects, deferredSearch, deferredTypeFilter]);

  const toggleType = (type: string): void => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header + Filters */}
      <div className="p-4 space-y-3 border-b border-edge">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Indexed Siebel Objects
            <span className="ml-2 text-xs font-normal text-muted">
              {filtered.length}{filtered.length !== objects.length ? ` / ${objects.length}` : ""} objects
            </span>
          </h3>
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search objects..."
          aria-label="Search Siebel objects"
          className="w-full px-3 py-1.5 text-xs rounded-md border border-edge bg-surface text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />

        {/* Type filter chips */}
        {allTypes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allTypes.map((type) => {
              const color = SIEBEL_TYPE_COLORS[type] || "#6b7280";
              const active = typeFilter.has(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  aria-label={`Filter by ${type}`}
                  aria-pressed={active}
                  className="px-2 py-0.5 text-[10px] rounded-md border transition-colors cursor-pointer"
                  style={{
                    borderColor: active ? color : "var(--color-border)",
                    backgroundColor: active ? `${color}15` : "transparent",
                    color: active ? color : "var(--color-text-muted)",
                  }}
                >
                  {type.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-muted">
          {objects.length === 0
            ? "No Siebel objects indexed yet. Upload a .sif file."
            : "No objects match the current filters."}
        </div>
      ) : (
        <div
          className="flex-1 overflow-auto"
          style={{ contentVisibility: "auto", containIntrinsicSize: `0 ${filtered.length * ROW_HEIGHT}px` }}
        >
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-alt z-10">
              <tr className="border-b border-edge">
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium">Type</th>
                <th className="text-left px-4 py-2 font-medium">Project</th>
                <th className="text-left px-4 py-2 font-medium">Preview</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((obj, i) => {
                const color = SIEBEL_TYPE_COLORS[obj.siebelType ?? ""] || "#6b7280";
                return (
                  <tr
                    key={i}
                    className="border-b border-edge hover:bg-surface transition-colors"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <td className="px-4 py-1.5 font-mono">{obj.title}</td>
                    <td className="px-4 py-1.5">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px]"
                        style={{ backgroundColor: `${color}15`, color }}
                      >
                        {obj.siebelType ?? obj.sourceType}
                      </span>
                    </td>
                    <td className="px-4 py-1.5 text-muted">{obj.siebelProject ?? "-"}</td>
                    <td className="px-4 py-1.5 text-muted truncate max-w-xs">{obj.contentPreview}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
