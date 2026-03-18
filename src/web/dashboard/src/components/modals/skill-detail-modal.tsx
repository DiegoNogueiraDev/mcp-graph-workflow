import React from "react";
import type { Skill } from "@/lib/types";

interface SkillDetailModalProps {
  skill: Skill | null;
  onClose: () => void;
  onToggle: (name: string, enabled: boolean) => void;
  onDelete?: (id: string) => void;
  onEdit?: (skill: Skill) => void;
}

const PHASE_COLORS: Record<string, string> = {
  ANALYZE: "#8b5cf6", DESIGN: "#3b82f6", PLAN: "#06b6d4", IMPLEMENT: "#10b981",
  VALIDATE: "#f59e0b", REVIEW: "#ef4444", HANDOFF: "#ec4899", LISTENING: "#6b7280",
};

export function SkillDetailModal({ skill, onClose, onToggle, onDelete, onEdit }: SkillDetailModalProps): React.JSX.Element | null {
  if (!skill) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[var(--color-bg)] rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold truncate">{skill.name}</h2>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xl">&times;</button>
        </div>

        <p className="text-sm text-[var(--color-text-muted)] mb-4">{skill.description}</p>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-4">
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            skill.source === "built-in" ? "bg-blue-500/10 text-blue-500" :
            skill.source === "custom" ? "bg-purple-500/10 text-purple-500" :
            "bg-gray-500/10 text-gray-500"
          }`}>
            {skill.source}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--color-border)] text-[var(--color-text-muted)]">
            {skill.category}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--color-border)] text-[var(--color-text-muted)]">
            {skill.estimatedTokens.toLocaleString()} tokens
          </span>
        </div>

        {/* Phases */}
        {skill.phases && skill.phases.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {skill.phases.map((phase) => {
              const color = PHASE_COLORS[phase] ?? "#6b7280";
              return (
                <span key={phase} className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ background: `${color}20`, color }}>
                  {phase}
                </span>
              );
            })}
          </div>
        )}

        {/* Toggle */}
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={skill.enabled}
              onChange={(e) => onToggle(skill.name, e.target.checked)}
              className="w-4 h-4 accent-[var(--color-accent)]"
            />
            {skill.enabled ? "Enabled" : "Disabled"}
          </label>
        </div>

        {/* Actions for custom skills */}
        {skill.source === "custom" && (
          <div className="flex gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(skill)}
                className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)]"
              >
                Edit
              </button>
            )}
            {onDelete && skill.id && (
              <button
                onClick={() => onDelete(skill.id!)}
                className="px-3 py-1.5 text-sm text-red-500 border border-red-500/30 rounded hover:bg-red-500/10"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
