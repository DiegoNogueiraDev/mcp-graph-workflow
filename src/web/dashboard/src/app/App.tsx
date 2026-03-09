import { useState, useCallback, lazy, Suspense } from "react";
import { ThemeProvider } from "@/providers/theme-provider";
import { Header } from "@/components/layout/header";
import { TabNav, type TabId } from "@/components/layout/tab-nav";
import { useGraphData } from "@/hooks/use-graph-data";
import { useStats } from "@/hooks/use-stats";
import { useSSE } from "@/hooks/use-sse";
import { ImportModal } from "@/components/modals/import-modal";
import { CaptureModal } from "@/components/modals/capture-modal";

// Lazy-load tabs
const GraphTab = lazy(() => import("@/components/tabs/graph-tab").then((m) => ({ default: m.GraphTab })));
const PrdBacklogTab = lazy(() => import("@/components/tabs/prd-backlog-tab").then((m) => ({ default: m.PrdBacklogTab })));
const CodeGraphTab = lazy(() => import("@/components/tabs/code-graph-tab").then((m) => ({ default: m.CodeGraphTab })));
const InsightsTab = lazy(() => import("@/components/tabs/insights-tab").then((m) => ({ default: m.InsightsTab })));

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
    <div className="h-screen flex flex-col">
      <Header
        stats={stats}
        onImport={() => setImportOpen(true)}
        onCapture={() => setCaptureOpen(true)}
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
          <Suspense fallback={<LoadingFallback />}>
            {activeTab === "graph" && graph && <GraphTab graph={graph} />}
            {activeTab === "prd-backlog" && graph && <PrdBacklogTab graph={graph} />}
            {activeTab === "code-graph" && <CodeGraphTab />}
            {activeTab === "insights" && <InsightsTab />}
          </Suspense>
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
    </div>
  );
}

export function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
