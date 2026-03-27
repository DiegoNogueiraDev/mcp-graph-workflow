import { memo, useState, useCallback, useEffect } from "react";
import { useTheme } from "@/providers/theme-provider";
import { ProjectSelector } from "./project-selector";
import {
  GitFork,
  ClipboardList,
  Route,
  Network,
  Code,
  Database,
  Brain,
  BarChart3,
  Zap,
  Target,
  Timer,
  ScrollText,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeft,
  Menu,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type TabId =
  | "graph"
  | "prd-backlog"
  | "journey"
  | "gitnexus"
  | "memories"
  | "insights"
  | "skills"
  | "context"
  | "benchmark"
  | "logs"
  | "siebel"
  | "lsp";

interface NavItem {
  id: TabId;
  label: string;
  icon: LucideIcon;
  beta?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: "graph", label: "Graph", icon: GitFork },
  { id: "prd-backlog", label: "PRD & Backlog", icon: ClipboardList },
  { id: "journey", label: "Journey", icon: Route, beta: true },
  { id: "gitnexus", label: "Code Graph", icon: Network },
  { id: "siebel", label: "Siebel", icon: Database, beta: true },
  { id: "lsp", label: "LSP", icon: Code, beta: true },
  { id: "memories", label: "Memories", icon: Brain },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "skills", label: "Skills", icon: Zap },
  { id: "context", label: "Context", icon: Target },
  { id: "benchmark", label: "Benchmark", icon: Timer },
  { id: "logs", label: "Logs", icon: ScrollText },
];

const STORAGE_KEY = "mcp-graph-sidebar-collapsed";

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export const Sidebar = memo(function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch { /* noop */ }
      return next;
    });
  }, []);

  const handleTabChange = useCallback(
    (tab: TabId) => {
      onTabChange(tab);
      setMobileOpen(false);
    },
    [onTabChange],
  );

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    function handleKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-edge">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
          <GitFork className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-foreground truncate">
            mcp-graph
          </span>
        )}
      </div>

      {/* Nav Items */}
      <nav role="navigation" aria-label="Main navigation" className="flex-1 overflow-y-auto py-2 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={`
                group relative flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium
                transition-colors duration-200
                ${isActive
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:bg-surface-elevated hover:text-foreground"
                }
              `}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="truncate">{item.label}</span>
                  {item.beta && (
                    <span className="ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-warning/15 text-warning">
                      beta
                    </span>
                  )}
                </>
              )}

              {/* Tooltip for collapsed state */}
              {collapsed && (
                <span className="
                  absolute left-full ml-2 px-2 py-1 rounded-md text-xs font-medium
                  bg-surface-elevated text-foreground border border-edge shadow-lg
                  opacity-0 pointer-events-none group-hover:opacity-100
                  transition-opacity duration-150 whitespace-nowrap z-50
                ">
                  {item.label}
                  {item.beta && " (beta)"}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-edge px-3 py-3 space-y-2">
        {/* Project Selector */}
        {!collapsed && (
          <div className="pb-1">
            <ProjectSelector />
          </div>
        )}

        {/* Theme toggle + Collapse toggle */}
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          <button
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            className="p-2 rounded-lg text-muted hover:bg-surface-elevated hover:text-foreground transition-colors"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Collapse toggle — hidden on mobile */}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden md:flex p-2 rounded-lg text-muted hover:bg-surface-elevated hover:text-foreground transition-colors"
          >
            {collapsed ? (
              <PanelLeft className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger — shown only on small screens */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 md:hidden p-2 rounded-lg bg-surface-alt border border-edge shadow-sm hover:bg-surface-elevated transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-[240px]
          bg-surface-alt border-r border-edge
          transform transition-transform duration-200 ease-out
          md:hidden
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        aria-label="Navigation sidebar"
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-muted hover:bg-surface-elevated hover:text-foreground transition-colors"
          aria-label="Close navigation menu"
        >
          <X className="w-4 h-4" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`
          hidden md:flex flex-col flex-shrink-0 h-full
          bg-surface-alt border-r border-edge
          transition-[width] duration-200 ease-out
          ${collapsed ? "w-16" : "w-60"}
        `}
        aria-label="Navigation sidebar"
      >
        {sidebarContent}
      </aside>
    </>
  );
});
