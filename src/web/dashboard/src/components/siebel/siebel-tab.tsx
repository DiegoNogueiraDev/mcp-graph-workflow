/**
 * SiebelTab — Orchestrator with sidebar navigation and section routing.
 * Delegates to UploadSection, ObjectsSection, GraphSection, GenerationSection.
 * Manages shared state: parsed SIF graph data flows to Graph section.
 */

import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { SiebelSidebar, type SiebelSection } from "./siebel-sidebar";
import { useSiebelData } from "@/hooks/use-siebel-data";
import { useSiebelGeneration } from "@/hooks/use-siebel-generation";
import { UploadSection } from "./upload-section";
import { ObjectsSection } from "./objects-section";
import { GenerationSection } from "./generation-section";
import { apiClient } from "@/lib/api-client";
import type { SiebelObjectData, SiebelDependencyData } from "./siebel-graph-utils";

const GraphSection = lazy(() =>
  import("./graph-section").then((m) => ({ default: m.GraphSection })),
);

function LoadingFallback(): React.JSX.Element {
  return (
    <div className="flex items-center justify-center h-full text-muted text-xs">
      Loading...
    </div>
  );
}

export function SiebelTab(): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<SiebelSection>("upload");
  const { objects, templates, loading, error, refresh } = useSiebelData();
  const gen = useSiebelGeneration(refresh);

  // Graph data state
  const [graphObjects, setGraphObjects] = useState<SiebelObjectData[]>([]);
  const [graphDependencies, setGraphDependencies] = useState<SiebelDependencyData[]>([]);

  // Load graph data from API
  const loadGraphData = useCallback(async () => {
    try {
      const result = await apiClient.siebelGetGraph();
      setGraphObjects(result.objects as SiebelObjectData[]);
      setGraphDependencies(result.dependencies as SiebelDependencyData[]);
    } catch {
      // Graph endpoint may not be available yet — non-fatal
    }
  }, []);

  // Load graph data on mount and after uploads
  useEffect(() => {
    void loadGraphData();
  }, [loadGraphData]);

  const handleUploaded = useCallback(() => {
    void refresh();
    void loadGraphData();
  }, [refresh, loadGraphData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted">
        Loading Siebel...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <SiebelSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        objectCount={objects.length}
      />

      <main className="flex-1 min-w-0 overflow-hidden">
        {activeSection === "upload" && (
          <UploadSection onUploaded={handleUploaded} />
        )}
        {activeSection === "objects" && (
          <ObjectsSection objects={objects} />
        )}
        {activeSection === "graph" && (
          <Suspense fallback={<LoadingFallback />}>
            <GraphSection objects={graphObjects} dependencies={graphDependencies} />
          </Suspense>
        )}
        {activeSection === "generation" && (
          <GenerationSection templates={templates} gen={gen} />
        )}
      </main>
    </div>
  );
}
