import React from "react";
import { DreamPhaseViz } from "./dream-phase-viz";
import type { DreamStatus, DreamCycleResult } from "@/lib/types";

interface DreamPanelProps {
  status: DreamStatus;
  onStartCycle: () => void;
  onCancelCycle: () => void;
  onPreview: () => Promise<DreamCycleResult | null>;
}

export function DreamPanel({ status, onStartCycle, onCancelCycle, onPreview }: DreamPanelProps): React.JSX.Element {
  const [previewing, setPreviewing] = React.useState(false);

  const handlePreview = async (): Promise<void> => {
    setPreviewing(true);
    try {
      await onPreview();
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status + Phase Stepper */}
      <div className="p-4 rounded-xl border border-edge shadow-sm bg-surface-alt">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                status.running ? "bg-blue-500 animate-pulse" : "bg-gray-500"
              }`}
            />
            <span className="text-sm font-medium">
              {status.running ? "Dream Cycle Running" : "Idle"}
            </span>
            {status.running && status.progress !== undefined && (
              <span className="text-xs text-muted">
                ({Math.round(status.progress * 100)}%)
              </span>
            )}
          </div>
        </div>
        <DreamPhaseViz status={status} />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {!status.running ? (
          <>
            <button
              onClick={onStartCycle}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer transition-colors duration-200"
            >
              Start Dream Cycle
            </button>
            <button
              onClick={() => void handlePreview()}
              disabled={previewing}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-edge text-muted hover:text-white hover:border-blue-500 cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {previewing ? "Previewing..." : "Preview (Dry Run)"}
            </button>
          </>
        ) : (
          <button
            onClick={onCancelCycle}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600/80 text-white hover:bg-red-600 cursor-pointer transition-colors duration-200"
          >
            Cancel Cycle
          </button>
        )}
      </div>
    </div>
  );
}
