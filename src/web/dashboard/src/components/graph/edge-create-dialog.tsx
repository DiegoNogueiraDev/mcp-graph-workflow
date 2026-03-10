import { useState, useCallback } from "react";
import type { RelationType } from "@/lib/types";
import { EDGE_STYLES } from "@/lib/constants";
import { apiClient } from "@/lib/api-client";

const RELATION_TYPES: RelationType[] = [
  "depends_on",
  "blocks",
  "parent_of",
  "child_of",
  "related_to",
  "priority_over",
  "implements",
  "derived_from",
];

interface EdgeCreateDialogProps {
  fromId: string;
  toId: string;
  fromTitle?: string;
  toTitle?: string;
  onCreated: () => void;
  onCancel: () => void;
}

export function EdgeCreateDialog({
  fromId,
  toId,
  fromTitle,
  toTitle,
  onCreated,
  onCancel,
}: EdgeCreateDialogProps): React.JSX.Element {
  const [relationType, setRelationType] = useState<RelationType>("depends_on");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await apiClient.createEdge({
        from: fromId,
        to: toId,
        relationType,
        reason: reason.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create edge");
    } finally {
      setLoading(false);
    }
  }, [fromId, toId, relationType, reason, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg shadow-xl w-96 p-4">
        <h3 className="text-sm font-bold mb-3">Create Relationship</h3>

        <div className="space-y-3 text-sm">
          <div>
            <label className="text-xs text-[var(--color-text-muted)] block mb-1">From</label>
            <div className="text-xs bg-[var(--color-bg-tertiary)] px-2 py-1.5 rounded truncate">
              {fromTitle ?? fromId}
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--color-text-muted)] block mb-1">To</label>
            <div className="text-xs bg-[var(--color-bg-tertiary)] px-2 py-1.5 rounded truncate">
              {toTitle ?? toId}
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--color-text-muted)] block mb-1">Relation Type</label>
            <select
              value={relationType}
              onChange={(e) => setRelationType(e.target.value as RelationType)}
              className="w-full text-xs px-2 py-1.5 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            >
              {RELATION_TYPES.map((rt) => {
                const style = EDGE_STYLES[rt];
                return (
                  <option key={rt} value={rt}>
                    {style.label}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="text-xs text-[var(--color-text-muted)] block mb-1">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why this relationship exists..."
              className="w-full text-xs px-2 py-1.5 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {error && (
            <div className="text-xs text-[var(--color-danger)] bg-[var(--color-bg-tertiary)] px-2 py-1.5 rounded">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1.5 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded bg-[var(--color-accent)] text-white font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
