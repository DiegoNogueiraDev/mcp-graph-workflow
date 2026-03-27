/**
 * Siebel Environments Section — CRUD for Siebel environment configurations.
 */

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";

interface SiebelEnvironment {
  name: string;
  url: string;
  version: string;
  type: string;
  composerUrl?: string;
  restApiUrl?: string;
}

export function EnvironmentsSection(): React.JSX.Element {
  const [environments, setEnvironments] = useState<SiebelEnvironment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", url: "", version: "", type: "dev" });

  useEffect(() => { loadEnvironments(); }, []);

  async function loadEnvironments(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const data = await apiClient.siebelGetEnvironments();
      setEnvironments(data.environments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load environments");
    } finally {
      setLoading(false);
    }
  }

  async function addEnvironment(): Promise<void> {
    if (!form.name || !form.url || !form.version) return;
    try {
      const data = await apiClient.siebelAddEnvironment(form);
      setEnvironments(data.environments);
      setShowForm(false);
      setForm({ name: "", url: "", version: "", type: "dev" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add environment");
    }
  }

  async function deleteEnvironment(name: string): Promise<void> {
    try {
      const data = await apiClient.siebelDeleteEnvironment(name);
      setEnvironments(data.environments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete environment");
    }
  }

  const typeColor = (t: string): string => {
    if (t === "prod") return "bg-red-500/20 text-red-400";
    if (t === "staging") return "bg-yellow-500/20 text-yellow-400";
    if (t === "test") return "bg-blue-500/20 text-blue-400";
    return "bg-green-500/20 text-green-400";
  };

  if (loading) return <div className="p-4 text-zinc-400">Loading environments...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-zinc-300">Siebel Environments ({environments.length})</h3>
        <button
          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-500"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Cancel" : "Add Environment"}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {showForm && (
        <div className="rounded-lg bg-zinc-800 p-4 space-y-2">
          <input className="w-full rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-200" placeholder="Name (e.g., DEV01)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="w-full rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-200" placeholder="URL (e.g., https://siebel-dev.example.com)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          <div className="flex gap-2">
            <input className="flex-1 rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-200" placeholder="Version (e.g., 22.x)" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
            <select className="rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-200" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="dev">dev</option>
              <option value="test">test</option>
              <option value="staging">staging</option>
              <option value="prod">prod</option>
            </select>
          </div>
          <button className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-500" onClick={addEnvironment}>Save</button>
        </div>
      )}

      {environments.length === 0 ? (
        <div className="text-xs text-zinc-500 text-center py-8">No environments configured. Add one to get started.</div>
      ) : (
        <div className="space-y-1">
          {environments.map((env) => (
            <div key={env.name} className="flex items-center justify-between rounded bg-zinc-800 p-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-200">{env.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${typeColor(env.type)}`}>{env.type}</span>
                  <span className="text-xs text-zinc-500">v{env.version}</span>
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">{env.url}</div>
              </div>
              <button
                className="rounded bg-red-600/20 px-2 py-1 text-xs text-red-400 hover:bg-red-600/40"
                onClick={() => deleteEnvironment(env.name)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
