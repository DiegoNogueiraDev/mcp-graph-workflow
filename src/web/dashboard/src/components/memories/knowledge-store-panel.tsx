import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

interface KnowledgeDoc {
  id: string;
  title: string;
  sourceType: string;
  content?: string;
  createdAt?: string;
}

export function KnowledgeStorePanel(): React.JSX.Element {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [stats, setStats] = useState<{ total: number; bySource: Record<string, number> } | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgeDoc[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [docsRes, statsRes] = await Promise.all([
        apiClient.knowledgeList(50),
        apiClient.knowledgeGetStats(),
      ]);
      setDocs(docsRes.documents);
      setStats(statsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSearch = useCallback(async () => {
    if (!search.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const res = await apiClient.knowledgeSearch(search, 20);
      setSearchResults(res.results as KnowledgeDoc[]);
    } catch {
      setSearchResults([]);
    }
  }, [search]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this knowledge document?")) return;
    try {
      await apiClient.knowledgeDelete(id);
      await loadData();
    } catch {
      // ignore
    }
  }, [loadData]);

  const displayDocs = searchResults ?? docs;

  if (loading) return <div className="text-zinc-400 p-4">Loading knowledge store...</div>;
  if (error) return <div className="text-red-400 p-4">Error: {error}</div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="flex gap-3 flex-wrap">
          <div className="bg-zinc-800 rounded-lg px-4 py-2 border border-zinc-700">
            <span className="text-lg font-bold text-zinc-100">{stats.total}</span>
            <span className="text-xs text-zinc-500 ml-2">total docs</span>
          </div>
          {Object.entries(stats.bySource).map(([source, count]) => (
            <div key={source} className="bg-zinc-800 rounded-lg px-3 py-2 border border-zinc-700">
              <span className="text-sm font-medium text-zinc-200">{count}</span>
              <span className="text-xs text-zinc-500 ml-1">{source}</span>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search knowledge store..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-md text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button onClick={handleSearch} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 text-sm">Search</button>
        {searchResults && (
          <button onClick={() => { setSearchResults(null); setSearch(""); }} className="px-3 py-2 bg-zinc-700 text-zinc-300 rounded-md hover:bg-zinc-600 text-sm">Clear</button>
        )}
      </div>

      {/* Doc list */}
      <div className="text-xs text-zinc-500">{displayDocs.length} documents{searchResults ? " (search results)" : ""}</div>
      <div className="space-y-1">
        {displayDocs.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between p-3 rounded-md hover:bg-zinc-800/50 group">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-zinc-200 truncate">{doc.title}</div>
              <div className="text-xs text-zinc-500">{doc.sourceType}{doc.createdAt ? ` - ${new Date(doc.createdAt).toLocaleDateString()}` : ""}</div>
            </div>
            <button
              onClick={() => handleDelete(doc.id)}
              className="text-xs text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded hover:bg-red-900/30"
            >
              Delete
            </button>
          </div>
        ))}
        {displayDocs.length === 0 && <div className="text-zinc-500 text-sm p-4 text-center">No documents found</div>}
      </div>
    </div>
  );
}
