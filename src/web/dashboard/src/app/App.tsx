import React, { useState, useCallback, lazy, Suspense } from "react";
import { ThemeProvider } from "@/providers/theme-provider";
import { ProjectProvider } from "@/providers/project-provider";
import { Sidebar, type TabId } from "@/components/layout/sidebar";
import { useGraphData } from "@/hooks/use-graph-data";
import { useStats } from "@/hooks/use-stats";
import { useSSE } from "@/hooks/use-sse";
import { ImportModal } from "@/components/modals/import-modal";
import { CaptureModal } from "@/components/modals/capture-modal";
import { OpenFolderModal } from "@/components/modals/open-folder-modal";
import { FolderOpen, FileUp, Globe } from "lucide-react";
import { SkeletonPage } from "@/components/layout/skeleton";

// Lazy-load tabs
const GraphTab = lazy(() => import("@/components/tabs/graph-tab").then((m) => ({ default: m.GraphTab })));
const PrdBacklogTab = lazy(() => import("@/components/tabs/prd-backlog-tab").then((m) => ({ default: m.PrdBacklogTab })));
const JourneyTab = lazy(() => import("@/components/tabs/journey-tab").then((m) => ({ default: m.JourneyTab })));
const GitNexusTab = lazy(() => import("@/components/tabs/gitnexus-tab").then((m) => ({ default: m.GitNexusTab })));
const MemoriesTab = lazy(() => import("@/components/tabs/memories-tab").then((m) => ({ default: m.MemoriesTab })));
const InsightsTab = lazy(() => import("@/components/tabs/insights-tab").then((m) => ({ default: m.InsightsTab })));
const SkillsTab = lazy(() => import("@/components/tabs/skills-tab").then((m) => ({ default: m.SkillsTab })));
const ContextTab = lazy(() => import("@/components/tabs/context-tab").then((m) => ({ default: m.ContextTab })));
const BenchmarkTab = lazy(() => import("@/components/tabs/benchmark-tab").then((m) => ({ default: m.BenchmarkTab })));
const LogsTab = lazy(() => import("@/components/tabs/logs-tab").then((m) => ({ default: m.LogsTab })));
const SiebelTab = lazy(() => import("@/components/siebel/siebel-tab").then((m) => ({ default: m.SiebelTab })));
const LspTab = lazy(() => import("@/components/tabs/lsp-tab").then((m) => ({ default: m.LspTab })));

const TAB_LABELS: Record<TabId, string> = {
  graph: "Graph",
  "prd-backlog": "PRD & Backlog",
  journey: "Journey",
  gitnexus: "Code Graph",
  siebel: "Siebel",
  lsp: "LSP",
  memories: "Memories",
  insights: "Insights",
  skills: "Skills",
  context: "Context",
  benchmark: "Benchmark",
  logs: "Logs",
};

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
    return { hasError: true, error };
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-muted">
          <p className="text-sm">Something went wrong.</p>
          <p className="text-xs text-danger">{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs px-3 py-1.5 rounded-lg bg-accent text-white hover:opacity-90 transition-opacity"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingFallback(): React.JSX.Element {
  return <SkeletonPage />;
}

function AppContent(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>("graph");
  const [importOpen, setImportOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [openFolderOpen, setOpenFolderOpen] = useState(false);

  const { graph, loading, error, refresh } = useGraphData();
  const { stats, refresh: refreshStats } = useStats();

  const handleRefresh = useCallback(async () => {
    await Promise.all([refresh(), refreshStats()]);
  }, [refresh, refreshStats]);

  // SSE: auto-refresh on backend events
  useSSE(useCallback(() => {
    void handleRefresh();
  }, [handleRefresh]));

  const done = stats?.byStatus?.done ?? 0;
  const total = stats?.totalNodes ?? 0;

  return (
    <ProjectProvider onProjectChange={handleRefresh}>
      {/* Skip navigation for a11y */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-accent focus:text-white focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <div className="h-screen flex flex-row">
        {/* Sidebar navigation */}
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main area: header + content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Slim header */}
          <header className="flex items-center justify-between gap-2 px-4 py-2 border-b border-edge bg-surface-alt md:px-6">
            {/* Left: breadcrumb + stats */}
            <div className="flex items-center gap-3 pl-10 md:pl-0">
              <h1 className="text-sm font-semibold text-foreground">
                {TAB_LABELS[activeTab]}
              </h1>
              {total > 0 && (
                <span className="text-xs text-muted">
                  {done}/{total} done
                </span>
              )}
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setOpenFolderOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-edge rounded-lg hover:bg-surface-elevated transition-colors"
                aria-label="Open project folder"
                title="Open a different project folder"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Open Folder</span>
              </button>
              <button
                onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent-light transition-colors"
                aria-label="Import PRD file"
              >
                <FileUp className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Import PRD</span>
              </button>
              <button
                onClick={() => setCaptureOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-edge rounded-lg hover:bg-surface-elevated transition-colors"
                aria-label="Capture web content"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Capture</span>
              </button>
            </div>
          </header>

          {/* Content */}
          <main id="main-content" className="flex-1 min-h-0 overflow-hidden">
            {loading ? (
              <LoadingFallback />
            ) : error ? (
              <div className="flex items-center justify-center h-full text-danger">
                {error}
              </div>
            ) : (
              <ErrorBoundary>
                <Suspense fallback={<LoadingFallback />}>
                  {/* Keep-alive: hide with CSS instead of unmounting to avoid expensive re-renders */}
                  <div style={{ display: activeTab === "graph" ? "contents" : "none" }}>
                    {graph && <GraphTab graph={graph} />}
                  </div>
                  <div style={{ display: activeTab === "prd-backlog" ? "contents" : "none" }}>
                    {graph && <PrdBacklogTab graph={graph} />}
                  </div>
                  {activeTab === "journey" && <JourneyTab />}
                  {activeTab === "gitnexus" && <GitNexusTab />}
                  {activeTab === "memories" && <MemoriesTab />}
                  {activeTab === "insights" && <InsightsTab />}
                  {activeTab === "skills" && <SkillsTab />}
                  {activeTab === "context" && <ContextTab />}
                  {activeTab === "benchmark" && <BenchmarkTab />}
                  {activeTab === "logs" && <LogsTab />}
                  {activeTab === "siebel" && <SiebelTab />}
                  {activeTab === "lsp" && <LspTab />}
                </Suspense>
              </ErrorBoundary>
            )}
          </main>
        </div>

        <ImportModal
          open={importOpen}
          onClose={() => setImportOpen(false)}
          onImported={handleRefresh}
        />
        <CaptureModal
          open={captureOpen}
          onClose={() => setCaptureOpen(false)}
          onImported={handleRefresh}
        />
        <OpenFolderModal
          open={openFolderOpen}
          onClose={() => setOpenFolderOpen(false)}
          onFolderChanged={handleRefresh}
        />
      </div>
    </ProjectProvider>
  );
}

export function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
