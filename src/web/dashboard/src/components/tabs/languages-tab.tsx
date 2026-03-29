import { useState, useCallback, useMemo } from "react";
import { Languages, ArrowLeftRight, Clock, BarChart3, Loader2, BookOpen, GitFork } from "lucide-react";
import { ReactFlow, Background, Controls, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Dagre from "@dagrejs/dagre";
import { useTranslation } from "@/hooks/use-translation";
import { useTranslationHistory } from "@/hooks/use-translation-history";
import { useProjectTranslation } from "@/hooks/use-project-translation";
import { useSSE } from "@/hooks/use-sse";
import { TranslationForm } from "@/components/languages/translation-form";
import { AnalysisResults } from "@/components/languages/analysis-results";
import { FinalizeResults } from "@/components/languages/finalize-results";
import { HistorySection } from "@/components/languages/history-section";
import { ZipUploadZone } from "@/components/languages/zip-upload-zone";
import { ProjectModeLayout } from "@/components/languages/project-mode-layout";
import { KnowledgeSection } from "@/components/languages/knowledge-section";
import type { TranslationScope } from "@/lib/types";

type SubTab = "convert" | "history" | "insights" | "knowledge" | "graph";

const SUB_TABS: Array<{ id: SubTab; label: string; icon: React.ReactNode }> = [
  { id: "convert", label: "Convert", icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
  { id: "history", label: "History", icon: <Clock className="w-3.5 h-3.5" /> },
  { id: "insights", label: "Insights", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: "knowledge", label: "Knowledge", icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: "graph", label: "Graph", icon: <GitFork className="w-3.5 h-3.5" /> },
];

// Module-level form state — survives component unmount/remount from parent re-renders
const persistedForm = {
  sourceCode: "",
  targetLanguage: "python",
  scope: "snippet" as TranslationScope,
  generatedCode: "",
};

interface TranslationFlowGraphProps {
  jobs: Array<{ status: string; sourceLanguage: string; targetLanguage: string; confidenceScore?: number }>;
}

function TranslationFlowGraph({ jobs }: TranslationFlowGraphProps): React.JSX.Element {
  const doneJobs = useMemo(() => jobs.filter(j => j.status === "done" && j.confidenceScore != null), [jobs]);

  const { flowNodes, flowEdges } = useMemo(() => {
    if (doneJobs.length === 0) return { flowNodes: [] as Node[], flowEdges: [] as Edge[] };

    const languages = new Set<string>();
    const edgeMap = new Map<string, { count: number; totalConf: number }>();

    for (const job of doneJobs) {
      languages.add(job.sourceLanguage);
      languages.add(job.targetLanguage);
      const key = `${job.sourceLanguage}->${job.targetLanguage}`;
      const existing = edgeMap.get(key) ?? { count: 0, totalConf: 0 };
      existing.count++;
      existing.totalConf += job.confidenceScore ?? 0;
      edgeMap.set(key, existing);
    }

    const nodes: Node[] = [...languages].map((lang) => ({
      id: lang,
      data: { label: lang },
      position: { x: 0, y: 0 },
      style: {
        background: "rgba(99, 102, 241, 0.1)",
        border: "1px solid rgba(99, 102, 241, 0.3)",
        borderRadius: "8px",
        padding: "8px 16px",
        color: "#a5b4fc",
        fontSize: "12px",
        fontWeight: 600,
      },
    }));

    const edges: Edge[] = [...edgeMap.entries()].map(([key, val]) => {
      const [source, target] = key.split("->");
      const avgConf = Math.round((val.totalConf / val.count) * 100);
      const color = avgConf >= 80 ? "#22c55e" : avgConf >= 50 ? "#eab308" : "#ef4444";
      return {
        id: key,
        source,
        target,
        label: `x${val.count} · ${avgConf}%`,
        style: { stroke: color, strokeWidth: 2 },
        labelStyle: { fill: "#9ca3af", fontSize: 10 },
        labelBgStyle: { fill: "#1e1e2e", fillOpacity: 0.9 },
        animated: true,
      };
    });

    // Apply dagre layout
    const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: "LR", nodesep: 80, ranksep: 150 });
    nodes.forEach(n => g.setNode(n.id, { width: 120, height: 40 }));
    edges.forEach(e => g.setEdge(e.source, e.target));
    Dagre.layout(g);
    nodes.forEach(n => {
      const pos = g.node(n.id);
      n.position = { x: pos.x - 60, y: pos.y - 20 };
    });

    return { flowNodes: nodes, flowEdges: edges };
  }, [doneJobs]);

  if (doneJobs.length === 0) {
    return (
      <div className="text-center py-12">
        <GitFork className="w-12 h-12 text-muted mx-auto mb-3" />
        <p className="text-sm text-muted">Translation graph visualization</p>
        <p className="text-[10px] text-muted mt-1">Complete some translations to see the relationship graph</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <GitFork className="w-4 h-4 text-accent" />
        <h3 className="text-xs font-semibold text-foreground">Translation Flow Graph</h3>
        <span className="text-[10px] text-muted">({doneJobs.length} completed translations)</span>
      </div>
      <div style={{ height: 400 }} className="rounded-lg border border-edge bg-surface-alt">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          fitView
          proOptions={{ hideAttribution: true }}
          style={{ background: "transparent" }}
        >
          <Background color="#333" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

export function LanguagesTab(): React.JSX.Element {
  const [subTab, setSubTab] = useState<SubTab>("convert");
  const [translation, translationActions] = useTranslation();
  const [history, historyActions] = useTranslationHistory();
  const [projectState, projectActions] = useProjectTranslation();

  const [sourceCode, setSourceCodeState] = useState(persistedForm.sourceCode);
  const [targetLanguage, setTargetLanguageState] = useState(persistedForm.targetLanguage);
  const [scope, setScopeState] = useState<TranslationScope>(persistedForm.scope);
  const [generatedCode, setGeneratedCodeState] = useState(persistedForm.generatedCode);

  // Wrap setters to persist values outside component lifecycle
  const setSourceCode = useCallback((v: string) => { persistedForm.sourceCode = v; setSourceCodeState(v); }, []);
  const setTargetLanguage = useCallback((v: string) => { persistedForm.targetLanguage = v; setTargetLanguageState(v); }, []);
  const setScope = useCallback((v: TranslationScope) => { persistedForm.scope = v; setScopeState(v); }, []);
  const setGeneratedCode = useCallback((v: string) => { persistedForm.generatedCode = v; setGeneratedCodeState(v); }, []);

  const isProjectMode = projectState.mode !== "idle";

  const handleZipUpload = useCallback((file: File) => {
    void projectActions.upload(file, targetLanguage);
  }, [projectActions, targetLanguage]);

  // SSE: auto-refresh history on translation events (skip during active analysis to avoid re-render)
  const translationPhase = translation.phase;
  useSSE(useCallback((event: string) => {
    if (event.startsWith("translation:") && translationPhase !== "analyzing" && translationPhase !== "finalizing") {
      void historyActions.refresh();
    }
  }, [historyActions, translationPhase]));

  const handleAnalyze = (): void => {
    void translationActions.analyze(sourceCode, targetLanguage, scope);
  };

  const handleFinalize = (): void => {
    void translationActions.finalize(generatedCode).then(() => historyActions.refresh());
  };

  const handleReset = (): void => {
    translationActions.reset();
    setSourceCode("");
    setGeneratedCode("");
    setTargetLanguage("python");
    setScope("snippet");
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 space-y-4 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Languages className="w-5 h-5 text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Language Convert</h2>
          <span className="text-[10px] px-1.5 py-0.5 bg-warning/10 text-warning rounded-full">Beta</span>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex gap-1 border-b border-edge pb-1">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t transition-colors ${
                subTab === tab.id
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground hover:bg-surface"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Convert sub-tab */}
        {subTab === "convert" && (
          <div className="space-y-4">
            {/* ZIP Upload Zone */}
            <ZipUploadZone onUpload={handleZipUpload} loading={projectState.loading} />

            {isProjectMode ? (
              <ProjectModeLayout
                project={projectState.project!}
                files={projectState.files}
                summary={projectState.summary}
                selectedFileId={projectState.selectedFileId}
                onSelectFile={projectActions.selectFile}
                onPrepareAll={() => void projectActions.prepareFiles()}
                onDownloadAll={() => void projectActions.downloadProject()}
                onFinalizeFile={(fileId, code) => void projectActions.finalizeFile(fileId, code)}
                loading={projectState.loading}
              />
            ) : (
              <>
                <TranslationForm
                  sourceCode={sourceCode}
                  setSourceCode={setSourceCode}
                  targetLanguage={targetLanguage}
                  setTargetLanguage={setTargetLanguage}
                  scope={scope}
                  setScope={setScope}
                  generatedCode={generatedCode}
                  setGeneratedCode={setGeneratedCode}
                  translation={translation}
                  onAnalyze={handleAnalyze}
                  onFinalize={handleFinalize}
                  onReset={handleReset}
                />

                {/* Animated processing card during analysis */}
                {translation.phase === "analyzing" && (
                  <div className="rounded-lg border-2 border-accent/40 bg-accent/5 p-5 transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-accent/20 animate-ping" />
                        <Loader2 className="w-5 h-5 text-accent animate-spin relative" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-foreground">Analyzing your code...</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-accent font-medium">Detecting language</span>
                          <span className="text-[10px] text-muted">→</span>
                          <span className="text-[10px] text-muted">Analyzing constructs</span>
                          <span className="text-[10px] text-muted">→</span>
                          <span className="text-[10px] text-muted">Generating prompt</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 h-1 rounded-full bg-surface overflow-hidden">
                      <div className="h-full bg-accent/60 rounded-full animate-pulse" style={{ width: "60%" }} />
                    </div>
                  </div>
                )}

                {/* Finalizing indicator */}
                {translation.phase === "finalizing" && (
                  <div className="rounded-lg border-2 border-green-500/40 bg-green-500/5 p-5 transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-green-500 animate-spin" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">Finalizing translation...</p>
                        <p className="text-[10px] text-muted mt-1">Validating output and generating evidence pack</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Results with fade-in */}
                {translation.analysis && (
                  <div className="animate-in fade-in-0 duration-300" style={{ animationFillMode: "both" }}>
                    <AnalysisResults analysis={translation.analysis} />
                  </div>
                )}
                {translation.finalizeResult && (
                  <div className="animate-in fade-in-0 duration-300" style={{ animationFillMode: "both" }}>
                    <FinalizeResults result={translation.finalizeResult} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* History & Insights share the same data */}
        {(subTab === "history" || subTab === "insights") && (
          <HistorySection
            state={history}
            actions={historyActions}
            showInsights={subTab === "insights"}
          />
        )}

        {subTab === "knowledge" && <KnowledgeSection />}

        {subTab === "graph" && (
          <TranslationFlowGraph jobs={history.jobs} />
        )}
      </div>
    </div>
  );
}
