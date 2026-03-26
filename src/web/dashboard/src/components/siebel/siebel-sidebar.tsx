/**
 * SiebelSidebar — Left navigation for Siebel tab sections.
 */

import { memo } from "react";

export type SiebelSection = "upload" | "objects" | "graph" | "generation";

interface SiebelSidebarProps {
  activeSection: SiebelSection;
  onSectionChange: (section: SiebelSection) => void;
  objectCount: number;
}

const SECTIONS: Array<{ id: SiebelSection; label: string; icon: string }> = [
  { id: "upload", label: "Upload", icon: "M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" },
  { id: "objects", label: "Objects", icon: "M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" },
  { id: "graph", label: "Graph", icon: "M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" },
  { id: "generation", label: "Generation", icon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" },
];

export const SiebelSidebar = memo(function SiebelSidebar({
  activeSection,
  onSectionChange,
  objectCount,
}: SiebelSidebarProps) {
  return (
    <nav
      className="w-48 flex-shrink-0 border-r border-edge bg-surface-alt flex flex-col"
      aria-label="Siebel sections"
    >
      <div className="px-3 py-3 border-b border-edge">
        <h2 className="text-xs font-semibold uppercase text-muted tracking-wider">
          Siebel
        </h2>
      </div>
      <div className="flex-1 py-1">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            aria-label={`Navigate to ${section.label}`}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
              activeSection === section.id
                ? "bg-accent/10 text-accent border-r-2 border-accent"
                : "text-muted hover:text-foreground hover:bg-surface"
            }`}
          >
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={section.icon} />
            </svg>
            <span>{section.label}</span>
            {section.id === "objects" && objectCount > 0 && (
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-surface text-muted">
                {objectCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
});
