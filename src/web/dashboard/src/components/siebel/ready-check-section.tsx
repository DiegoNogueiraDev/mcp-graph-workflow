/**
 * Siebel Ready Check Section — visual checklist for definition of ready.
 */

import { useState } from "react";
import { apiClient } from "@/lib/api-client";

interface ReadyCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export function ReadyCheckSection(): React.JSX.Element {
  const [sifContent, setSifContent] = useState("");
  const [prefix, setPrefix] = useState("CX_");
  const [checks, setChecks] = useState<ReadyCheck[]>([]);
  const [ready, setReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runCheck(): Promise<void> {
    if (!sifContent.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiClient.siebelRunReadyCheck(sifContent, prefix);
      setChecks(data.checks);
      setReady(data.ready);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-zinc-800 p-4">
        <h3 className="mb-2 text-sm font-semibold text-zinc-300">Definition of Ready</h3>
        <textarea
          className="mb-2 w-full rounded bg-zinc-900 p-2 text-xs text-zinc-200 font-mono"
          rows={4}
          placeholder="Paste SIF XML content to check readiness..."
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
            onClick={runCheck}
            disabled={loading || !sifContent.trim()}
          >
            {loading ? "Checking..." : "Check Readiness"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>

      {ready !== null && (
        <div className={`rounded-lg p-4 text-center ${ready ? "bg-green-900/30" : "bg-red-900/30"}`}>
          <div className={`text-2xl font-bold ${ready ? "text-green-400" : "text-red-400"}`}>
            {ready ? "READY" : "NOT READY"}
          </div>
          <div className="text-xs text-zinc-400 mt-1">
            {checks.filter((c) => c.passed).length}/{checks.length} checks passed
          </div>
        </div>
      )}

      {checks.length > 0 && (
        <div className="space-y-1">
          {checks.map((check) => (
            <div key={check.name} className="flex items-start gap-2 rounded bg-zinc-800 p-2">
              <span className={`text-lg ${check.passed ? "text-green-400" : "text-red-400"}`}>
                {check.passed ? "\u2713" : "\u2717"}
              </span>
              <div>
                <div className="text-xs font-semibold text-zinc-200">{check.name.replace(/_/g, " ")}</div>
                <div className="text-xs text-zinc-400">{check.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
