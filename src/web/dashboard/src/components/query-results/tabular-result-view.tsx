import { useState, useMemo } from "react";

interface TabularResultViewProps {
  data: Array<Record<string, unknown>>;
  pageSize?: number;
}

export function TabularResultView({ data, pageSize = 50 }: TabularResultViewProps): React.JSX.Element {
  const [page, setPage] = useState(0);

  const headers = useMemo(() => {
    if (data.length === 0) return [];
    // Collect all unique keys across all rows
    const keySet = new Set<string>();
    for (const row of data) {
      for (const key of Object.keys(row)) {
        keySet.add(key);
      }
    }
    return Array.from(keySet);
  }, [data]);

  const totalPages = Math.ceil(data.length / pageSize);
  const pageData = data.slice(page * pageSize, (page + 1) * pageSize);

  if (data.length === 0) {
    return (
      <div className="p-4 text-sm text-muted">
        No results
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs text-muted mb-2">
        {data.length} rows
      </div>

      <div className="overflow-x-auto rounded-lg border border-edge">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-edge bg-surface-alt text-left text-muted">
              {headers.map((h) => (
                <th key={h} className="py-1.5 px-2 font-medium whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr
                key={i}
                className="border-b border-edge hover:bg-surface-elevated transition-colors"
              >
                {headers.map((h) => (
                  <td key={h} className="py-1 px-2 max-w-[300px] truncate">
                    {formatCell(row[h])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-2 text-xs">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-2 py-0.5 rounded bg-surface-elevated disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-muted">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-2 py-0.5 rounded bg-surface-elevated disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
