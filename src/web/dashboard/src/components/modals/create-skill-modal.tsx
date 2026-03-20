import React, { useState, useCallback, useEffect } from "react";
import type { CustomSkillInput, Skill } from "@/lib/types";
import { LIFECYCLE_PHASES } from "@/lib/constants";
const CATEGORIES = ["know-me", "software-design", "security", "testing", "cost-reducer", "research", "ddd", "frontend-design", "other"] as const;

interface CreateSkillModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CustomSkillInput) => Promise<void>;
  editSkill?: Skill | null;
}

export function CreateSkillModal({ open, onClose, onSubmit, editSkill }: CreateSkillModalProps): React.JSX.Element | null {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("know-me");
  const [phases, setPhases] = useState<string[]>(["IMPLEMENT"]);
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editSkill) {
      setName(editSkill.name);
      setDescription(editSkill.description);
      setCategory(editSkill.category);
      setPhases(editSkill.phases ?? ["IMPLEMENT"]);
      setInstructions("");
    } else {
      setName("");
      setDescription("");
      setCategory("know-me");
      setPhases(["IMPLEMENT"]);
      setInstructions("");
    }
    setError(null);
  }, [editSkill, open]);

  const togglePhase = useCallback((phase: string) => {
    setPhases((prev) => prev.includes(phase) ? prev.filter((p) => p !== phase) : [...prev, phase]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || !description.trim() || !instructions.trim() || phases.length === 0) {
      setError("All fields are required and at least one phase must be selected.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), description: description.trim(), category, phases, instructions: instructions.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save skill");
    } finally {
      setSubmitting(false);
    }
  }, [name, description, category, phases, instructions, onSubmit, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--color-bg)] rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{editSkill ? "Edit Skill" : "Create Custom Skill"}</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xl">&times;</button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-workflow"
              disabled={!!editSkill}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] disabled:opacity-50"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this skill do?"
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Phases */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Phases</label>
            <div className="flex flex-wrap gap-2">
              {LIFECYCLE_PHASES.map((phase) => (
                <button
                  key={phase}
                  type="button"
                  onClick={() => togglePhase(phase)}
                  className={`px-2 py-1 text-[10px] font-medium rounded-full border transition-colors ${
                    phases.includes(phase)
                      ? "bg-[var(--color-accent)]/10 border-[var(--color-accent)] text-[var(--color-accent)]"
                      : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text)]"
                  }`}
                >
                  {phase}
                </button>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1">Instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={6}
              placeholder="Instructions for the AI agent when this skill is active..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] resize-y"
            />
          </div>

          {error && (
            <div className="text-sm p-2 rounded bg-red-500/10 text-red-500">{error}</div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)]"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-3 py-1.5 text-sm bg-[var(--color-accent)] text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Saving..." : editSkill ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
