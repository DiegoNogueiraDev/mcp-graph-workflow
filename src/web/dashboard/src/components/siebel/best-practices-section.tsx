/**
 * Siebel Best Practices Section — filterable list of 60 rules with examples.
 */

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";

interface BestPracticeRule {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: string;
  correct: string;
  incorrect: string;
}

export function BestPracticesSection(): React.JSX.Element {
  const [rules, setRules] = useState<BestPracticeRule[]>([]);
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => { loadRules(); }, []);

  async function loadRules(): Promise<void> {
    setLoading(true);
    try {
      const data = await apiClient.siebelGetBestPractices();
      setRules(data.rules);
    } catch { /* empty */ } finally { setLoading(false); }
  }

  const categories = [...new Set(rules.map((r) => r.category))];
  const filtered = rules.filter((r) => {
    if (categoryFilter && r.category !== categoryFilter) return false;
    if (filter && !r.title.toLowerCase().includes(filter.toLowerCase()) && !r.description.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const toggleExpand = (id: string): void => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  const severityBadge = (s: string): string => {
    if (s === "error") return "bg-red-500/20 text-red-400";
    if (s === "warning") return "bg-yellow-500/20 text-yellow-400";
    return "bg-blue-500/20 text-blue-400";
  };

  if (loading) return <div className="p-4 text-zinc-400">Loading best practices...</div>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200"
          placeholder="Search rules..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <select
          className="rounded bg-zinc-800 px-2 py-1.5 text-xs text-zinc-200"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories ({rules.length})</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c} ({rules.filter((r) => r.category === c).length})</option>
          ))}
        </select>
      </div>

      <div className="space-y-1 max-h-[500px] overflow-y-auto">
        {filtered.map((rule) => (
          <div key={rule.id} className="rounded bg-zinc-800 p-2">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => toggleExpand(rule.id)}
            >
              <span className="text-zinc-500 text-xs w-16">{rule.id}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${severityBadge(rule.severity)}`}>{rule.severity}</span>
              <span className="text-xs text-zinc-200 flex-1">{rule.title}</span>
              <span className="text-zinc-500 text-xs">{expanded.has(rule.id) ? "▼" : "▶"}</span>
            </div>
            {expanded.has(rule.id) && (
              <div className="mt-2 ml-16 space-y-1 text-xs">
                <p className="text-zinc-400">{rule.description}</p>
                <div className="flex gap-4 mt-1">
                  <div className="flex-1">
                    <span className="text-green-400 font-semibold">Correct:</span>
                    <pre className="mt-0.5 rounded bg-zinc-900 p-1.5 text-green-300/80 whitespace-pre-wrap">{rule.correct}</pre>
                  </div>
                  <div className="flex-1">
                    <span className="text-red-400 font-semibold">Incorrect:</span>
                    <pre className="mt-0.5 rounded bg-zinc-900 p-1.5 text-red-300/80 whitespace-pre-wrap">{rule.incorrect}</pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-xs text-zinc-500">Showing {filtered.length} of {rules.length} rules</div>
    </div>
  );
}
