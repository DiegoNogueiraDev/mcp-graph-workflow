import React, { useState, useCallback, lazy, Suspense } from "react";
import { ThemeProvider } from "@/providers/theme-provider";
import { ProjectProvider } from "@/providers/project-provider";
import { Header } from "@/components/layout/header";
import { TabNav, type TabId } from "@/components/layout/tab-nav";
import { useGraphData } from "@/hooks/use-graph-data";
import { useStats } from "@/hooks/use-stats";
import { useSSE } from "@/hooks/use-sse";
import { ImportModal } from "@/components/modals/import-modal";
import { CaptureModal } from "@/components/modals/capture-modal";
import { OpenFolderModal } from "@/components/modals/open-folder-modal";

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
const SiebelTab = lazy(() => import("@/components/tabs/siebel-tab").then((m) => ({ default: m.SiebelTab })));

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
        <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--color-text-muted)]">
          <p className="text-sm">Something went wrong.</p>
          <p className="text-xs text-[var(--color-danger)]">{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity"
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
  return (
    <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
      Loading...
    </div>
  );
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

  return (
    <ProjectProvider onProjectChange={handleRefresh}>
      <div className="h-screen flex flex-col">
        <Header
          stats={stats}
          onImport={() => setImportOpen(true)}
          onCapture={() => setCaptureOpen(true)}
          onOpenFolder={() => setOpenFolderOpen(true)}
        />
        <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <LoadingFallback />
          ) : error ? (
            <div className="flex items-center justify-center h-full text-[var(--color-danger)]">
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
              </Suspense>
            </ErrorBoundary>
          )}
        </main>

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
