import React, { useState } from "react";
import { useSkills } from "@/hooks/use-skills";
import type { Skill, Recommendation } from "@/lib/types";

const LIFECYCLE_PHASES = ["ANALYZE", "DESIGN", "PLAN", "IMPLEMENT", "VALIDATE", "REVIEW", "HANDOFF", "LISTENING"] as const;

const PHASE_COLORS: Record<string, string> = {
  ANALYZE: "#8b5cf6",
  DESIGN: "#3b82f6",
  PLAN: "#06b6d4",
  IMPLEMENT: "#10b981",
  VALIDATE: "#f59e0b",
  REVIEW: "#ef4444",
  HANDOFF: "#ec4899",
  LISTENING: "#6b7280",
};

const TOKEN_BUDGET = 4000;

// ── Sub-components ────────────────────────────────

function MetricCard({ value, label }: { value: string | number; label: string }): React.JSX.Element {
  return (
    <div
      className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center"
      data-testid="metric-card"
    >
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] text-[var(--color-text-muted)] uppercase">{label}</div>
    </div>
  );
}

function PhaseBadge({ phase }: { phase: string }): React.JSX.Element {
  const color = PHASE_COLORS[phase] ?? "#6b7280";
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ background: `${color}20`, color }}
    >
      {phase}
    </span>
  );
}

function SourceBadge({ source }: { source: "built-in" | "filesystem" }): React.JSX.Element {
  const isBuiltIn = source === "built-in";
  return (
    <span
      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
        isBuiltIn
          ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
          : "bg-[var(--color-text-muted)]/10 text-[var(--color-text-muted)]"
      }`}
    >
      {source}
    </span>
  );
}

function SkillCard({ skill }: { skill: Skill }): React.JSX.Element {
  return (
    <div className="p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-sm font-medium truncate">{skill.name}</span>
        <div className="flex items-center gap-1.5 shrink-0">
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

function PhaseSection({ phase, skills }: { phase: string; skills: Skill[] }): React.JSX.Element {
  const [open, setOpen] = useState(true);
  const color = PHASE_COLORS[phase] ?? "#6b7280";

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
            {skills.length}
          </span>
        </span>
        <span className="text-[var(--color-text-muted)]">{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {skills.map((skill) => (
            <SkillCard key={skill.name} skill={skill} />
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

function TokenBudgetBar({ totalTokens }: { totalTokens: number }): React.JSX.Element {
  const ratio = Math.min(totalTokens / TOKEN_BUDGET, 1);
  const pct = Math.round(ratio * 100);
  const barColor = ratio > 0.8 ? "#ef4444" : ratio > 0.5 ? "#f59e0b" : "#10b981";

  return (
    <div data-testid="token-budget-bar" className="p-4 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase">Token Budget</h3>
        <span className="text-xs text-[var(--color-text-muted)]">
          {totalTokens.toLocaleString()} / {TOKEN_BUDGET.toLocaleString()} tokens ({pct}%)
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-[var(--color-border)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────

export function SkillsTab(): React.JSX.Element {
  const { skills, recommendations, totalTokens, loading, error, refresh } = useSkills();

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
  const fsCount = skills.filter((s) => s.source === "filesystem").length;

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
        <button
          onClick={() => void refresh()}
          className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
        >
          Refresh
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="skills-stats">
        <MetricCard value={skills.length} label="Total Skills" />
        <MetricCard value={builtInCount} label="Built-in" />
        <MetricCard value={fsCount} label="Filesystem" />
        <MetricCard value={totalTokens.toLocaleString()} label="Total Tokens" />
      </div>

      {/* Token budget bar */}
      <TokenBudgetBar totalTokens={totalTokens} />

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
          <PhaseSection key={phase} phase={phase} skills={phaseSkills} />
        ))}
        {otherSkills.length > 0 && (
          <PhaseSection phase="Other" skills={otherSkills} />
        )}
      </div>
    </div>
  );
}
