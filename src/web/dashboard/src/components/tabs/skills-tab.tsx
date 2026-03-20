import React, { useState, useCallback } from "react";
import { useSkills } from "@/hooks/use-skills";
import { SkillDetailModal } from "@/components/modals/skill-detail-modal";
import { CreateSkillModal } from "@/components/modals/create-skill-modal";
import type { Skill, Recommendation, CustomSkillInput } from "@/lib/types";
import { LIFECYCLE_PHASES, PHASE_COLORS } from "@/lib/constants";

const TOKEN_BUDGET = 4000;

// ── Sub-components ────────────────────────────────

function MetricCard({ value, label }: { value: string | number; label: string }): React.JSX.Element {
  return (
    <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center" data-testid="metric-card">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] text-[var(--color-text-muted)] uppercase">{label}</div>
    </div>
  );
}

function PhaseBadge({ phase }: { phase: string }): React.JSX.Element {
  const color = PHASE_COLORS[phase] ?? "#6b7280";
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${color}20`, color }}>
      {phase}
    </span>
  );
}

function SourceBadge({ source }: { source: "built-in" | "filesystem" | "custom" }): React.JSX.Element {
  const colors = {
    "built-in": "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
    "filesystem": "bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)]",
    "custom": "bg-purple-500/10 text-purple-500",
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[source]}`}>
      {source}
    </span>
  );
}

function SkillCard({ skill, onToggle, onClick }: {
  skill: Skill;
  onToggle: (name: string, enabled: boolean) => void;
  onClick: (skill: Skill) => void;
}): React.JSX.Element {
  return (
    <div
      className={`p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] cursor-pointer hover:border-[var(--color-accent)]/50 transition-all ${
        !skill.enabled ? "opacity-50" : ""
      }`}
      onClick={() => onClick(skill)}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-medium truncate">{skill.name}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="checkbox"
            checked={skill.enabled}
            onChange={(e) => { e.stopPropagation(); onToggle(skill.name, e.target.checked); }}
            onClick={(e) => e.stopPropagation()}
            className="w-3.5 h-3.5 accent-[var(--color-accent)]"
          />
          <SourceBadge source={skill.source} />
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {skill.estimatedTokens.toLocaleString()} tok
          </span>
        </div>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">{skill.description}</p>
    </div>
  );
}

function PhaseSection({ phase, skills, onToggle, onSkillClick }: {
  phase: string;
  skills: Skill[];
  onToggle: (name: string, enabled: boolean) => void;
  onSkillClick: (skill: Skill) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(true);
  const color = PHASE_COLORS[phase] ?? "#6b7280";
  const enabledCount = skills.filter((s) => s.enabled).length;

  return (
    <div className="rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-[var(--color-bg-tertiary)] transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          {phase}
          <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-border)] text-[10px]">
            {enabledCount}/{skills.length}
          </span>
        </span>
        <span className="text-[var(--color-text-muted)]">{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {skills.map((skill) => (
            <SkillCard key={skill.name} skill={skill} onToggle={onToggle} onClick={onSkillClick} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }): React.JSX.Element {
  return (
    <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-accent)]/30">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium">{rec.skill}</span>
        <PhaseBadge phase={rec.phase} />
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">{rec.reason}</p>
    </div>
  );
}

function TokenBudgetBar({ totalTokens, activeTokens }: { totalTokens: number; activeTokens: number }): React.JSX.Element {
  const activeRatio = Math.min(activeTokens / TOKEN_BUDGET, 1);
  const totalRatio = Math.min(totalTokens / TOKEN_BUDGET, 1);
  const activePct = Math.round(activeRatio * 100);
  const activeColor = activeRatio > 0.8 ? "#ef4444" : activeRatio > 0.5 ? "#f59e0b" : "#10b981";

  return (
    <div data-testid="token-budget-bar" className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Token Budget</h3>
        <span className="text-xs text-[var(--color-text-muted)]">
          {activeTokens.toLocaleString()} active / {totalTokens.toLocaleString()} total ({activePct}%)
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-[var(--color-border)] relative">
        <div
          className="h-full rounded-full absolute top-0 left-0 opacity-30"
          style={{ width: `${Math.round(totalRatio * 100)}%`, background: "#6b7280" }}
        />
        <div
          className="h-full rounded-full absolute top-0 left-0 transition-all"
          style={{ width: `${activePct}%`, background: activeColor }}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────

export function SkillsTab(): React.JSX.Element {
  const {
    skills, recommendations, totalTokens, activeTokens,
    loading, error, refresh,
    toggleSkill, createSkill, updateSkill, deleteSkill,
  } = useSkills();

  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editSkill, setEditSkill] = useState<Skill | null>(null);

  const handleDelete = useCallback(async (id: string) => {
    await deleteSkill(id);
    setSelectedSkill(null);
  }, [deleteSkill]);

  const handleEdit = useCallback((skill: Skill) => {
    setSelectedSkill(null);
    setEditSkill(skill);
    setCreateModalOpen(true);
  }, []);

  const handleCreateSubmit = useCallback(async (data: CustomSkillInput) => {
    if (editSkill?.id) {
      await updateSkill(editSkill.id, data);
    } else {
      await createSkill(data);
    }
    setEditSkill(null);
  }, [editSkill, createSkill, updateSkill]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-danger)]">
        Failed to load skills: {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
        Loading skills...
      </div>
    );
  }

  const builtInCount = skills.filter((s) => s.source === "built-in").length;
  const customCount = skills.filter((s) => s.source === "custom").length;
  const enabledCount = skills.filter((s) => s.enabled).length;

  // Group skills by phase
  const skillsByPhase = new Map<string, Skill[]>();
  for (const phase of LIFECYCLE_PHASES) {
    const phaseSkills = skills.filter((s) => s.phases?.includes(phase));
    if (phaseSkills.length > 0) {
      skillsByPhase.set(phase, phaseSkills);
    }
  }

  // Skills without any phase (filesystem skills)
  const otherSkills = skills.filter((s) => !s.phases || s.phases.length === 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Skills</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setEditSkill(null); setCreateModalOpen(true); }}
            className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
          >
            + Custom Skill
          </button>
          <button
            onClick={() => void refresh()}
            className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" data-testid="skills-stats">
        <MetricCard value={skills.length} label="Total Skills" />
        <MetricCard value={builtInCount} label="Built-in" />
        <MetricCard value={customCount} label="Custom" />
        <MetricCard value={enabledCount} label="Enabled" />
        <MetricCard value={activeTokens.toLocaleString()} label="Active Tokens" />
      </div>

      {/* Token budget bar */}
      <TokenBudgetBar totalTokens={totalTokens} activeTokens={activeTokens} />

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div data-testid="recommendations-section" className="space-y-2">
          <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">
            Recommendations ({recommendations.length})
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {recommendations.map((rec) => (
              <RecommendationCard key={rec.skill} rec={rec} />
            ))}
          </div>
        </div>
      )}

      {/* Skills by phase */}
      <div data-testid="skills-by-phase" className="space-y-3">
        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">
          Skills by Lifecycle Phase
        </h3>
        {[...skillsByPhase.entries()].map(([phase, phaseSkills]) => (
          <PhaseSection
            key={phase}
            phase={phase}
            skills={phaseSkills}
            onToggle={toggleSkill}
            onSkillClick={setSelectedSkill}
          />
        ))}
        {otherSkills.length > 0 && (
          <PhaseSection phase="Other" skills={otherSkills} onToggle={toggleSkill} onSkillClick={setSelectedSkill} />
        )}
      </div>

      {/* Detail Modal */}
      <SkillDetailModal
        skill={selectedSkill}
        onClose={() => setSelectedSkill(null)}
        onToggle={toggleSkill}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />

      {/* Create/Edit Modal */}
      <CreateSkillModal
        open={createModalOpen}
        onClose={() => { setCreateModalOpen(false); setEditSkill(null); }}
        onSubmit={handleCreateSubmit}
        editSkill={editSkill}
      />
    </div>
  );
}
