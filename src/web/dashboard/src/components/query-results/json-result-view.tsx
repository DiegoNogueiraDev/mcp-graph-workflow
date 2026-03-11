import { useState, useCallback } from "react";

interface JsonResultViewProps {
  data: unknown;
}

export function JsonResultView({ data }: JsonResultViewProps): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text manually
    }
  }, [jsonString]);

  return (
    <div className="rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--color-border)]">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          {collapsed ? "▸ Show JSON" : "▾ JSON"}
        </button>
        <button
          onClick={() => void handleCopy()}
          className="text-[10px] px-2 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {!collapsed && (
        <pre className="p-3 text-xs whitespace-pre-wrap overflow-x-auto max-h-[400px] overflow-y-auto">
          {jsonString}
        </pre>
      )}
    </div>
  );
}
