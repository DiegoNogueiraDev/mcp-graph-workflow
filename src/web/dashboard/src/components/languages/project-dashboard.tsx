import { Files, CheckCircle2, AlertTriangle, XCircle, BarChart3, Play, Download } from "lucide-react";
import type { TranslationProject, TranslationProjectFile, TranslationProjectSummary } from "@/lib/types";
import { DeterministicIndicator } from "./deterministic-indicator";

interface ProjectDashboardProps {
  project: TranslationProject;
  files: TranslationProjectFile[];
  summary: TranslationProjectSummary | null;
  onPrepareAll: () => void;
  onDownloadAll: () => void;
  loading?: boolean;
}

interface ComputedStats {
  totalFiles: number;
  deterministicCount: number;
  needsAiCount: number;
  errorCount: number;
  avgConfidence: number;
  deterministicPct: number;
}

function computeStats(files: TranslationProjectFile[], summary: TranslationProjectSummary | null): ComputedStats {
  if (summary) {
    const deterministicCount = summary.translatedFiles;
    const needsAiCount = summary.pendingFiles + summary.analyzedFiles;
    return {
      totalFiles: summary.totalFiles,
      deterministicCount,
      needsAiCount,
      errorCount: summary.failedFiles,
      avgConfidence: summary.overallConfidence,
      deterministicPct: summary.deterministicPct,
    };
  }

  const totalFiles = files.length;
  if (totalFiles === 0) {
    return { totalFiles: 0, deterministicCount: 0, needsAiCount: 0, errorCount: 0, avgConfidence: 0, deterministicPct: 0 };
  }

  const deterministicCount = files.filter((f) => f.deterministic === true).length;
  const errorCount = files.filter((f) => f.status === "failed").length;
  const needsAiCount = files.filter((f) => f.deterministic === false && f.status !== "failed").length;

  const filesWithConfidence = files.filter((f) => f.confidenceScore != null);
  const avgConfidence =
    filesWithConfidence.length > 0
      ? filesWithConfidence.reduce((sum, f) => sum + (f.confidenceScore ?? 0), 0) / filesWithConfidence.length
      : 0;

  const deterministicPct = totalFiles > 0 ? Math.round((deterministicCount / totalFiles) * 100) : 0;

  return { totalFiles, deterministicCount, needsAiCount, errorCount, avgConfidence, deterministicPct };
}

interface StatCardProps {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  colorClass?: string;
}

function StatCard({ icon, value, label, colorClass = "text-foreground" }: StatCardProps): React.JSX.Element {
  return (
    <div className="rounded-lg border border-edge bg-surface-alt px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className={`text-xl font-bold ${colorClass}`}>{value}</span>
      </div>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  );
}

export function ProjectDashboard({
  project: _project,
  files,
  summary,
  onPrepareAll,
  onDownloadAll,
  loading,
}: ProjectDashboardProps): React.JSX.Element {
  const stats = computeStats(files, summary);
  const isFullyDeterministic = stats.deterministicPct === 100 && stats.totalFiles > 0;

  return (
    <div className="space-y-6">
      {/* Stats cards row */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard
          icon={<Files className="w-3.5 h-3.5 text-accent" />}
          value={stats.totalFiles}
          label="Total Files"
        />
        <StatCard
          icon={<CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
          value={stats.deterministicCount}
          label="Deterministic"
          colorClass="text-green-500"
        />
        <StatCard
          icon={<AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />}
          value={stats.needsAiCount}
          label="Needs AI"
          colorClass="text-yellow-500"
        />
        <StatCard
          icon={<XCircle className="w-3.5 h-3.5 text-red-500" />}
          value={stats.errorCount}
          label="Errors"
          colorClass="text-red-500"
        />
        <StatCard
          icon={<BarChart3 className="w-3.5 h-3.5 text-accent" />}
          value={`${Math.round(stats.avgConfidence * 100)}%`}
          label="Avg Confidence"
        />
      </div>

      {/* Deterministic indicator at project level */}
      <DeterministicIndicator
        isProjectLevel={true}
        deterministicPct={stats.deterministicPct}
        totalConstructs={stats.totalFiles}
      />

      {/* Bulk actions row */}
      <div className="flex items-center gap-3">
        <button
          onClick={onPrepareAll}
          disabled={loading || stats.totalFiles === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-3.5 h-3.5" />
          Convert All
        </button>
        <button
          onClick={onDownloadAll}
          disabled={loading || stats.totalFiles === 0}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isFullyDeterministic
              ? "bg-green-600 text-white hover:bg-green-700"
              : "border border-edge text-foreground hover:bg-surface"
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          Download All .zip
        </button>
      </div>
    </div>
  );
}
