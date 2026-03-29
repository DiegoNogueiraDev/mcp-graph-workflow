import type { TranslationProject, TranslationProjectFile, TranslationProjectSummary } from "@/lib/types";
import { ProjectFileTree } from "./project-file-tree";
import { ProjectDashboard } from "./project-dashboard";
import { ProjectFileDetail } from "./project-file-detail";

interface ProjectModeLayoutProps {
  project: TranslationProject;
  files: TranslationProjectFile[];
  summary: TranslationProjectSummary | null;
  selectedFileId: string | null;
  onSelectFile: (fileId: string | null) => void;
  onPrepareAll: () => void;
  onDownloadAll: () => void;
  onFinalizeFile: (fileId: string, generatedCode: string) => void;
  prompts?: Record<string, string>;
  loading?: boolean;
}

export function ProjectModeLayout({
  project,
  files,
  summary,
  selectedFileId,
  onSelectFile,
  onPrepareAll,
  onDownloadAll,
  onFinalizeFile,
  prompts,
  loading,
}: ProjectModeLayoutProps): React.JSX.Element {
  const selectedFile = selectedFileId ? files.find((f) => f.id === selectedFileId) ?? null : null;

  const handleBack = (): void => {
    onSelectFile(null);
  };

  const handleFinalize = (generatedCode: string): void => {
    if (selectedFileId) {
      onFinalizeFile(selectedFileId, generatedCode);
    }
  };

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Left: file tree */}
      <div className="w-full md:w-60 border-b md:border-b-0 md:border-r border-edge overflow-hidden flex flex-col shrink-0">
        <ProjectFileTree
          files={files}
          selectedFileId={selectedFileId}
          onSelectFile={onSelectFile}
        />
      </div>

      {/* Right: dashboard or file detail */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedFile ? (
          <ProjectFileDetail
            file={selectedFile}
            prompt={prompts?.[selectedFile.id]}
            onBack={handleBack}
            onFinalize={handleFinalize}
            loading={loading}
          />
        ) : (
          <ProjectDashboard
            project={project}
            files={files}
            summary={summary}
            onPrepareAll={onPrepareAll}
            onDownloadAll={onDownloadAll}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
