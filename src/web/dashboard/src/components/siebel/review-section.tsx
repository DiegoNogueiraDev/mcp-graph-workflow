/**
 * Siebel Review Section — code review form with quality score breakdown.
 */

import { useState } from "react";
import { apiClient } from "@/lib/api-client";

interface ReviewIssue {
  category: string;
  severity: string;
  objectName: string;
  detail: string;
  suggestion: string;
}

interface ReviewResult {
  issues: ReviewIssue[];
  score: number;
  breakdown: Record<string, number>;
  objectCount: number;
}

export function ReviewSection(): React.JSX.Element {
  const [sifContent, setSifContent] = useState("");
  const [prefix, setPrefix] = useState("CX_");
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runReview(): Promise<void> {
    if (!sifContent.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiClient.siebelRunReview(sifContent, prefix);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed");
    } finally {
      setLoading(false);
    }
  }

  const scoreColor = (score: number): string => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const severityColor = (s: string): string => {
    if (s === "error") return "text-red-400";
    if (s === "warning") return "text-yellow-400";
    return "text-blue-400";
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-zinc-800 p-4">
        <h3 className="mb-2 text-sm font-semibold text-zinc-300">Code Review</h3>
        <textarea
          className="mb-2 w-full rounded bg-zinc-900 p-2 text-xs text-zinc-200 font-mono"
          rows={6}
          placeholder="Paste SIF XML content here..."
          value={sifContent}
          onChange={(e) => setSifContent(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <input
            className="w-20 rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
            placeholder="Prefix"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
          />
          <button
            className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500 disabled:opacity-50"
            onClick={runReview}
            disabled={loading || !sifContent.trim()}
          >
            {loading ? "Reviewing..." : "Run Review"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>

      {result && (
        <>
          {/* Score */}
          <div className="rounded-lg bg-zinc-800 p-4 text-center">
            <div className={`text-4xl font-bold ${scoreColor(result.score)}`}>{result.score}</div>
            <div className="text-xs text-zinc-400">Quality Score ({result.objectCount} objects, {result.issues.length} issues)</div>
          </div>

          {/* Breakdown */}
          <div className="rounded-lg bg-zinc-800 p-4">
            <h3 className="mb-2 text-sm font-semibold text-zinc-300">Score Breakdown</h3>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(result.breakdown).map(([cat, score]) => (
                <div key={cat} className="rounded bg-zinc-700 p-2 text-center">
                  <div className={`text-lg font-bold ${scoreColor(score)}`}>{score}</div>
                  <div className="text-xs text-zinc-400">{cat.replace("_", " ")}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Issues */}
          {result.issues.length > 0 && (
            <div className="rounded-lg bg-zinc-800 p-4">
              <h3 className="mb-2 text-sm font-semibold text-zinc-300">Issues ({result.issues.length})</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {result.issues.map((issue, i) => (
                  <div key={i} className="rounded bg-zinc-700 p-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${severityColor(issue.severity)}`}>{issue.severity.toUpperCase()}</span>
                      <span className="text-zinc-400">{issue.category}</span>
                      <span className="text-zinc-500">| {issue.objectName}</span>
                    </div>
                    <div className="mt-1 text-zinc-300">{issue.detail}</div>
                    <div className="mt-1 text-green-400/70">{issue.suggestion}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
