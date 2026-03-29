import { useState, useCallback, useRef } from "react";
import { Upload, FileArchive, Loader2 } from "lucide-react";

interface ZipUploadZoneProps {
  onUpload: (file: File) => void;
  loading?: boolean;
  disabled?: boolean;
}

export function ZipUploadZone({ onUpload, loading, disabled }: ZipUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !loading) {
        setDragOver(true);
      }
    },
    [disabled, loading],
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      if (disabled || loading) return;

      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".zip")) {
        onUpload(file);
      }
    },
    [disabled, loading, onUpload],
  );

  const handleClick = useCallback(() => {
    if (!disabled && !loading) {
      inputRef.current?.click();
    }
  }, [disabled, loading]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.name.endsWith(".zip")) {
        onUpload(file);
      }
      // Reset so the same file can be selected again
      e.target.value = "";
    },
    [onUpload],
  );

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={`
        flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed
        px-4 py-5 text-center transition-colors cursor-pointer
        ${dragOver ? "border-accent bg-accent/5" : "border-edge bg-surface"}
        ${disabled || loading ? "opacity-50 cursor-not-allowed" : "hover:border-accent/60"}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || loading}
      />

      {loading ? (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <span className="text-sm text-muted">Uploading...</span>
        </>
      ) : (
        <>
          {dragOver ? (
            <FileArchive className="h-6 w-6 text-accent" />
          ) : (
            <Upload className="h-6 w-6 text-muted" />
          )}
          <span className="text-sm text-muted">
            Drop a <code className="text-xs">.zip</code> file or click to browse
          </span>
        </>
      )}
    </div>
  );
}
