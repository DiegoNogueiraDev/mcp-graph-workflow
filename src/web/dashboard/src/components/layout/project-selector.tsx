import { memo, useState, useRef, useEffect, useCallback } from "react";
import { useProject } from "@/hooks/use-project";

export const ProjectSelector = memo(function ProjectSelector() {
  const { projects, activeProject, loading, switchProject } = useProject();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Close on Escape
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  }, []);

  if (loading || projects.length <= 1) {
    // Single project or loading — show name only, no dropdown
    return (
      <span
        className="text-sm text-[var(--color-text-muted)] truncate max-w-[200px]"
        title={activeProject?.name}
      >
        {activeProject?.name ?? "No project"}
      </span>
    );
  }

  return (
    <div ref={dropdownRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-1 px-2 py-1 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-bg-tertiary)] transition-colors truncate max-w-[200px]"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select project"
      >
        <span className="truncate">{activeProject?.name ?? "Select project"}</span>
        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Projects"
          className="absolute top-full left-0 mt-1 w-56 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded shadow-lg z-50 max-h-60 overflow-y-auto"
        >
          {projects.map((project) => (
            <li key={project.id} role="option" aria-selected={project.id === activeProject?.id}>
              <button
                onClick={() => {
                  void switchProject(project.id);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-bg-tertiary)] transition-colors ${
                  project.id === activeProject?.id
                    ? "text-[var(--color-accent)] font-medium"
                    : "text-[var(--color-text)]"
                }`}
              >
                {project.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
