import { Download, X, AlertTriangle } from "lucide-react";

interface DownloadDialogProps {
  open: boolean;
  onClose: () => void;
  totalFiles: number;
  deterministicFiles: number;
  needsAiFiles: number;
  onDownloadAll: () => void;
  onDownloadDeterministicOnly: () => void;
}

export function DownloadDialog({
  open,
  onClose,
  totalFiles,
  deterministicFiles,
  needsAiFiles,
  onDownloadAll,
  onDownloadDeterministicOnly,
}: DownloadDialogProps): React.JSX.Element | null {
  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      <div className="bg-surface-alt rounded-lg border border-edge p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
            <h3 className="text-sm font-semibold text-foreground">Some files need AI review</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message */}
        <p className="text-xs text-muted mb-1">
          {needsAiFiles} of {totalFiles} files need AI review. Download anyway?
        </p>
        <div className="flex items-center gap-3 text-[10px] text-muted mb-6">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {deterministicFiles} deterministic
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            {needsAiFiles} needs review
          </span>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onDownloadAll}
            className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-md bg-accent/10 text-accent border border-accent/30 hover:bg-accent/20 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download All ({totalFiles} files)
          </button>
          <button
            onClick={onDownloadDeterministicOnly}
            className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-md border border-edge text-foreground hover:bg-surface transition-colors cursor-pointer"
          >
            Download Deterministic Only ({deterministicFiles} files)
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-muted hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
