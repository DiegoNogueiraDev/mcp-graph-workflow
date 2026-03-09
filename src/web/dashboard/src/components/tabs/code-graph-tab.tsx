import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";

export function CodeGraphTab(): React.JSX.Element {
  const [status, setStatus] = useState<{
    gitnexus?: { running: boolean; url: string };
    serena?: { memories?: Array<{ name: string; content: string }> };
  } | null>(null);
  const [memories, setMemories] = useState<Array<{ name: string; content: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const s = await apiClient.getIntegrationStatus();
        setStatus(s);

        if (!s.gitnexus?.running && s.serena?.memories?.length) {
          const mems = await apiClient.request<Array<{ name: string; content: string }>>("/integrations/serena/memories");
          setMemories(mems);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    }
    void load();
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-danger)]">
        Failed to load: {error}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        Loading...
      </div>
    );
  }

  if (status.gitnexus?.running) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-success)]20 text-[var(--color-success)] font-medium">
            GitNexus Running
          </span>
          <a
            href={status.gitnexus.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            Open in new tab
          </a>
        </div>
        <iframe
          src={status.gitnexus.url}
          className="flex-1 border-0"
          title="GitNexus Code Graph"
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6 p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
        <h3 className="text-base font-semibold mb-2">Code Graph (GitNexus not running)</h3>
        <p className="text-sm text-[var(--color-text-muted)] mb-2">
          Start GitNexus for interactive code graph visualization:
        </p>
        <code className="text-sm bg-[var(--color-bg-tertiary)] px-2 py-1 rounded">
          gitnexus analyze && gitnexus serve
        </code>
      </div>

      {memories.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Serena Memories (Codebase Overview)</h3>
          <div className="space-y-3">
            {memories.map((mem) => (
              <div key={mem.name} className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                <h4 className="text-sm font-medium mb-1">{mem.name}</h4>
                <pre className="text-xs whitespace-pre-wrap text-[var(--color-text-muted)] overflow-x-auto">
                  {mem.content}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {!memories.length && (
        <p className="text-sm text-[var(--color-text-muted)]">
          No Serena memories found. Configure Serena for codebase intelligence.
        </p>
      )}
    </div>
  );
}
