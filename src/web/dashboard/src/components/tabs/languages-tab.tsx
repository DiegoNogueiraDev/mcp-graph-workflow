import { useState, useCallback } from "react";
import { Languages, ArrowLeftRight, Clock, BarChart3 } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { useTranslationHistory } from "@/hooks/use-translation-history";
import { useSSE } from "@/hooks/use-sse";
import { TranslationForm } from "@/components/languages/translation-form";
import { AnalysisResults } from "@/components/languages/analysis-results";
import { FinalizeResults } from "@/components/languages/finalize-results";
import { HistorySection } from "@/components/languages/history-section";
import type { TranslationScope } from "@/lib/types";

type SubTab = "convert" | "history" | "insights";

const SUB_TABS: Array<{ id: SubTab; label: string; icon: React.ReactNode }> = [
  { id: "convert", label: "Convert", icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
  { id: "history", label: "History", icon: <Clock className="w-3.5 h-3.5" /> },
  { id: "insights", label: "Insights", icon: <BarChart3 className="w-3.5 h-3.5" /> },
];

// Module-level form state — survives component unmount/remount from parent re-renders
const persistedForm = {
  sourceCode: "",
  targetLanguage: "python",
  scope: "snippet" as TranslationScope,
  generatedCode: "",
};

export function LanguagesTab(): React.JSX.Element {
  const [subTab, setSubTab] = useState<SubTab>("convert");
  const [translation, translationActions] = useTranslation();
  const [history, historyActions] = useTranslationHistory();

  const [sourceCode, setSourceCodeState] = useState(persistedForm.sourceCode);
  const [targetLanguage, setTargetLanguageState] = useState(persistedForm.targetLanguage);
  const [scope, setScopeState] = useState<TranslationScope>(persistedForm.scope);
  const [generatedCode, setGeneratedCodeState] = useState(persistedForm.generatedCode);

  // Wrap setters to persist values outside component lifecycle
  const setSourceCode = useCallback((v: string) => { persistedForm.sourceCode = v; setSourceCodeState(v); }, []);
  const setTargetLanguage = useCallback((v: string) => { persistedForm.targetLanguage = v; setTargetLanguageState(v); }, []);
  const setScope = useCallback((v: TranslationScope) => { persistedForm.scope = v; setScopeState(v); }, []);
  const setGeneratedCode = useCallback((v: string) => { persistedForm.generatedCode = v; setGeneratedCodeState(v); }, []);

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
            <AnalysisResults analysis={translation.analysis} />
            <FinalizeResults result={translation.finalizeResult} />
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
      </div>
    </div>
  );
}
