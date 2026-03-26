/**
 * UploadProgress — Progress bar for SIF parsing with status label.
 */

import { memo } from "react";
import type { SifParseStatus } from "@/hooks/use-sif-parser";

interface UploadProgressProps {
  status: SifParseStatus;
  progress: number;
  error: string | null;
}

const STATUS_LABELS: Record<SifParseStatus, string> = {
  idle: "",
  reading: "Reading file...",
  parsing: "Parsing XML...",
  extracting: "Extracting objects...",
  inferring: "Inferring dependencies...",
  done: "Done!",
  error: "Error",
};

export const UploadProgress = memo(function UploadProgress({
  status,
  progress,
  error,
}: UploadProgressProps) {
  if (status === "idle") return null;

  const isError = status === "error";
  const isDone = status === "done";

  return (
    <div className="space-y-1.5" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-xs">
        <span className={isError ? "text-red-500" : isDone ? "text-green-500" : "text-muted"}>
          {isError ? error : STATUS_LABELS[status]}
        </span>
        {!isError && (
          <span className="text-[10px] text-muted">{progress}%</span>
        )}
      </div>
      {!isError && (
        <div className="h-1.5 rounded-full bg-surface overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isDone ? "bg-green-500" : "bg-accent"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
});
