/**
 * Siebel ERD Section — Mermaid ER diagram from repository BCs/Tables.
 */

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";

interface ErdData {
  tables: Array<{ name: string; bcName: string; columns: Array<{ name: string; fieldName: string }> }>;
  relationships: Array<{ fromTable: string; toTable: string; label: string }>;
  mermaid: string;
}

export function ErdSection(): React.JSX.Element {
  const [erd, setErd] = useState<ErdData | null>(null);
  const [project, setProject] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showMermaid, setShowMermaid] = useState(false);

  useEffect(() => { loadErd(); }, []);

  async function loadErd(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const data = await apiClient.siebelGetErd(project || undefined);
      setErd(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ERD");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-4 text-zinc-400">Loading ERD...</div>;
  if (error) return <div className="p-4 text-red-400">{error}</div>;
  if (!erd || erd.tables.length === 0) return <div className="p-4 text-zinc-500">No tables found. Import SIF files with Business Components first.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200"
          placeholder="Filter by project..."
          value={project}
          onChange={(e) => setProject(e.target.value)}
        />
        <button
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500"
          onClick={loadErd}
        >
          Refresh
        </button>
        <button
          className="rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
          onClick={() => setShowMermaid(!showMermaid)}
        >
          {showMermaid ? "Table View" : "Mermaid Code"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded bg-zinc-800 p-2">
          <span className="text-lg font-bold text-blue-400">{erd.tables.length}</span>
          <div className="text-zinc-400">Tables</div>
        </div>
        <div className="rounded bg-zinc-800 p-2">
          <span className="text-lg font-bold text-green-400">{erd.tables.reduce((sum, t) => sum + t.columns.length, 0)}</span>
          <div className="text-zinc-400">Columns</div>
        </div>
        <div className="rounded bg-zinc-800 p-2">
          <span className="text-lg font-bold text-yellow-400">{erd.relationships.length}</span>
          <div className="text-zinc-400">Relationships</div>
        </div>
      </div>

      {showMermaid ? (
        <pre className="rounded-lg bg-zinc-900 p-4 text-xs text-zinc-300 overflow-auto max-h-96 font-mono">{erd.mermaid}</pre>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {erd.tables.map((table) => (
            <div key={table.name} className="rounded bg-zinc-800 p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-zinc-200">{table.name}</span>
                <span className="text-xs text-zinc-500">BC: {table.bcName}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {table.columns.map((col) => (
                  <span key={col.name} className="rounded bg-zinc-700 px-1.5 py-0.5 text-xs text-zinc-300">{col.name}</span>
                ))}
              </div>
            </div>
          ))}

          {erd.relationships.length > 0 && (
            <div className="rounded bg-zinc-800 p-3">
              <h4 className="text-xs font-bold text-zinc-300 mb-1">Relationships</h4>
              {erd.relationships.map((rel, i) => (
                <div key={i} className="text-xs text-zinc-400">
                  {rel.fromTable} <span className="text-blue-400">--&gt;</span> {rel.toTable} <span className="text-zinc-500">({rel.label})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
