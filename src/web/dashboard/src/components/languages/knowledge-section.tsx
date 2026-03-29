import { useState } from "react";
import { BookOpen, Search, RefreshCw, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useTranslationKnowledge } from "@/hooks/use-translation-knowledge";

interface KnowledgeEntry {
  id: string;
  title: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  createdAt: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

function StatCard({ label, value }: { label: string; value: string | number }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-edge bg-surface-alt px-4 py-3">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function EntryCard({
  entry,
  expanded,
  onToggle,
  onSearch,
}: {
  entry: KnowledgeEntry;
  expanded: boolean;
  onToggle: () => void;
  onSearch: (query: string) => void;
}): React.JSX.Element {
  const meta = entry.metadata;
  const confPct = entry.confidence != null ? Math.round(entry.confidence * 100) : null;
  const confColor = confPct != null
    ? confPct >= 80 ? "text-green-500" : confPct >= 50 ? "text-yellow-500" : "text-red-500"
    : "text-muted";
  const riskCount = (meta?.riskCount as number) ?? 0;

  return (
    <div
      className="rounded-lg border border-edge bg-surface-alt px-4 py-3 cursor-pointer transition-colors hover:border-accent/30"
      onClick={onToggle}
    >
      <div className="flex items-center gap-2">
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-muted flex-shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted flex-shrink-0" />
        }
        <p className="text-xs font-medium text-foreground truncate flex-1">{entry.title}</p>
        <span className="text-[10px] text-muted flex-shrink-0">
          {new Date(entry.createdAt).toLocaleDateString()}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1.5 ml-5">
        {entry.sourceLanguage && entry.targetLanguage && (
          <span className="text-[10px] text-muted">
            {entry.sourceLanguage} → {entry.targetLanguage}
          </span>
        )}
        {confPct != null && (
          <span className={`text-[10px] ${confColor}`}>{confPct}%</span>
        )}
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-edge space-y-2 ml-5">
          <div className="flex items-center gap-2 flex-wrap">
            {meta?.sourceLanguage ? (
              <span className="px-2 py-0.5 text-[10px] rounded bg-blue-500/10 text-blue-400">
                {String(meta.sourceLanguage)}
              </span>
            ) : null}
            <span className="text-[10px] text-muted">&rarr;</span>
            {meta?.targetLanguage ? (
              <span className="px-2 py-0.5 text-[10px] rounded bg-green-500/10 text-green-400">
                {String(meta.targetLanguage)}
              </span>
            ) : null}
            {meta?.scope ? (
              <span className="px-2 py-0.5 text-[10px] rounded bg-accent/10 text-accent">
                {String(meta.scope)}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <span className="text-muted">Confidence: </span>
              <span className={confColor}>{confPct ?? "—"}%</span>
            </div>
            <div>
              <span className="text-muted">Constructs: </span>
              <span className="text-foreground">{(meta?.constructCount as number) ?? "—"}</span>
            </div>
            <div>
              <span className="text-muted">Risks: </span>
              <span className={riskCount > 0 ? "text-yellow-500" : "text-green-500"}>{riskCount}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSearch(entry.title);
            }}
            className="text-[10px] text-accent hover:text-accent/80 transition-colors"
          >
            View in Search
          </button>
        </div>
      )}
    </div>
  );
}

export function KnowledgeSection(): React.JSX.Element {
  const [state, { search, refresh }] = useTranslationKnowledge();
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent): void => {
    e.preventDefault();
    void search(query);
  };

  const handleReindex = (): void => {
    void refresh();
  };

  const entries: KnowledgeEntry[] = state.searchResults && state.searchResults.length > 0
    ? state.searchResults
    : state.knowledge?.recentEntries ?? [];

  const showSearchResults = state.searchResults && state.searchResults.length > 0;

  return (
    <div className="space-y-4">
      {/* Search + Reindex */}
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search knowledge base..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-edge bg-surface text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50"
          />
        </div>
        <button
          type="button"
          onClick={handleReindex}
          disabled={state.loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-edge text-muted hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
          title="Reindex knowledge"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${state.loading ? "animate-spin" : ""}`} />
          Reindex
        </button>
      </form>

      {/* Loading */}
      {state.loading && !state.knowledge && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-muted animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!state.loading && !state.knowledge && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <BookOpen className="w-12 h-12 text-muted/40" />
          <div>
            <p className="text-xs text-muted">No learnings yet.</p>
            <p className="text-[10px] text-muted/60 mt-1">
              Complete some translations to build the knowledge base.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      {state.knowledge && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total Entries" value={state.knowledge.totalDocuments ?? 0} />
          <StatCard label="Language Pairs" value={state.knowledge.byLanguagePair?.length ?? 0} />
          <StatCard
            label="Avg Confidence"
            value={
              state.knowledge.avgConfidence != null
                ? `${Math.round(state.knowledge.avgConfidence * 100)}%`
                : "—"
            }
          />
        </div>
      )}

      {/* Language pair badges */}
      {state.knowledge?.byLanguagePair && state.knowledge.byLanguagePair.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {state.knowledge.byLanguagePair.map((entry) => (
            <span
              key={entry.pair}
              className="px-2 py-0.5 text-[10px] font-medium rounded bg-accent/10 text-accent"
            >
              {entry.pair} ({entry.count})
            </span>
          ))}
        </div>
      )}

      {/* Section heading */}
      {entries.length > 0 && (
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-accent" />
          <h3 className="text-xs font-semibold text-foreground">
            {showSearchResults ? "Search Results" : "Recent Entries"}
          </h3>
          <span className="text-[10px] text-muted">({entries.length})</span>
        </div>
      )}

      {/* Entries list */}
      {entries.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-auto">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              onSearch={(q) => { setQuery(q); void search(q); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
