import React from "react";
import type { DreamStatus } from "@/lib/types";

const PHASES = [
  { key: "nrem", label: "NREM", subtitle: "Replay + Decay + Prune" },
  { key: "rem", label: "REM", subtitle: "Priority + Merge + Associate" },
  { key: "wake-ready", label: "Wake", subtitle: "Report + Synthesize" },
] as const;

const COLORS = {
  completed: "#10b981",
  active: "#3B82F6",
  pending: "#6b7280",
} as const;

interface DreamPhaseVizProps {
  status: DreamStatus;
}

function getPhaseState(
  phaseKey: string,
  currentPhase: string | undefined,
  running: boolean,
): "completed" | "active" | "pending" {
  if (!running) return "pending";
  const phaseOrder = ["nrem", "rem", "wake-ready"];
  const currentIdx = phaseOrder.indexOf(currentPhase ?? "");
  const thisIdx = phaseOrder.indexOf(phaseKey);
  if (thisIdx < currentIdx) return "completed";
  if (thisIdx === currentIdx) return "active";
  return "pending";
}

export function DreamPhaseViz({ status }: DreamPhaseVizProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      {PHASES.map((phase, i) => {
        const state = getPhaseState(phase.key, status.currentPhase, status.running);
        const color = COLORS[state];
        return (
          <React.Fragment key={phase.key}>
            <div className="flex flex-col items-center gap-1 min-w-[80px]">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-200"
                style={{
                  backgroundColor: state === "pending" ? "transparent" : color,
                  border: `2px solid ${color}`,
                  color: state === "pending" ? color : "#fff",
                }}
              >
                {i + 1}
              </div>
              <span
                className="text-[10px] font-semibold transition-colors duration-200"
                style={{ color }}
              >
                {phase.label}
              </span>
              <span className="text-[9px] text-muted text-center leading-tight">
                {phase.subtitle}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div
                className="h-0.5 flex-1 transition-colors duration-200"
                style={{
                  backgroundColor: getPhaseState(PHASES[i + 1].key, status.currentPhase, status.running) !== "pending"
                    ? COLORS.completed
                    : COLORS.pending,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
