import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api-client";

interface KnowledgeDoc {
  id: string;
  title: string;
  sourceType: string;
  qualityScore?: number;
}

export function KnowledgeFeedbackPanel(): React.JSX.Element {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedbackStatus, setFeedbackStatus] = useState<Record<string, string>>({});

  const loadDocs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiClient.knowledgeList(30);
      setDocs(res.documents);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  const handleFeedback = useCallback(async (docId: string, action: "helpful" | "unhelpful" | "outdated") => {
    try {
      await apiClient.knowledgeFeedback(docId, action);
      setFeedbackStatus((prev) => ({ ...prev, [docId]: action }));
    } catch {
      // ignore
    }
  }, []);

  if (loading) return <div className="text-zinc-400 p-4">Loading...</div>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500 mb-3">Rate knowledge documents to improve RAG quality. Your feedback adjusts quality scores.</p>
      {docs.map((doc) => {
        const status = feedbackStatus[doc.id];
        return (
          <div key={doc.id} className="flex items-center justify-between p-3 rounded-md hover:bg-zinc-800/50">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-zinc-200 truncate">{doc.title}</div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>{doc.sourceType}</span>
                {doc.qualityScore !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded ${doc.qualityScore > 0.7 ? "bg-green-900/30 text-green-400" : doc.qualityScore > 0.3 ? "bg-yellow-900/30 text-yellow-400" : "bg-red-900/30 text-red-400"}`}>
                    q:{(doc.qualityScore * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              {status ? (
                <span className={`text-xs px-2 py-1 rounded ${status === "helpful" ? "bg-green-900/30 text-green-400" : status === "unhelpful" ? "bg-red-900/30 text-red-400" : "bg-yellow-900/30 text-yellow-400"}`}>
                  {status}
                </span>
              ) : (
                <>
                  <button onClick={() => handleFeedback(doc.id, "helpful")} className="text-xs px-2 py-1 rounded bg-green-900/20 text-green-400 hover:bg-green-900/40">Helpful</button>
                  <button onClick={() => handleFeedback(doc.id, "unhelpful")} className="text-xs px-2 py-1 rounded bg-red-900/20 text-red-400 hover:bg-red-900/40">Unhelpful</button>
                  <button onClick={() => handleFeedback(doc.id, "outdated")} className="text-xs px-2 py-1 rounded bg-yellow-900/20 text-yellow-400 hover:bg-yellow-900/40">Outdated</button>
                </>
              )}
            </div>
          </div>
        );
      })}
      {docs.length === 0 && <div className="text-zinc-500 text-sm p-4 text-center">No knowledge documents yet</div>}
    </div>
  );
}
