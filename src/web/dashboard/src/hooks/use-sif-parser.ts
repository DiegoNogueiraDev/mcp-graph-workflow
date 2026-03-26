/**
 * Hook for off-main-thread SIF parsing via Web Worker.
 */

import { useState, useCallback, useRef, useEffect } from "react";

export type SifParseStatus = "idle" | "reading" | "parsing" | "extracting" | "inferring" | "done" | "error";

interface SifParseResult {
  metadata: {
    fileName: string;
    repositoryName: string;
    projectName?: string;
    objectCount: number;
    objectTypes: string[];
    extractedAt: string;
  };
  objects: Array<{
    name: string;
    type: string;
    project?: string;
    properties: Array<{ name: string; value: string }>;
    children: Array<{ name: string; type: string; properties: Array<{ name: string; value: string }>; children: never[]; parentName?: string }>;
    inactive?: boolean;
    parentName?: string;
  }>;
  dependencies: Array<{
    from: { name: string; type: string };
    to: { name: string; type: string };
    relationType: string;
    inferred: boolean;
  }>;
}

interface UseSifParserReturn {
  parse: (file: File) => void;
  result: SifParseResult | null;
  progress: number;
  status: SifParseStatus;
  error: string | null;
  reset: () => void;
}

export function useSifParser(): UseSifParserReturn {
  const [result, setResult] = useState<SifParseResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<SifParseStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const parse = useCallback((file: File) => {
    setResult(null);
    setError(null);
    setProgress(0);
    setStatus("reading");

    // Read file on main thread (fast for text), then offload parsing to worker
    file.text().then((content) => {
      setProgress(10);
      setStatus("parsing");

      // Terminate any previous worker
      workerRef.current?.terminate();

      const worker = new Worker(
        new URL("../workers/sif-parse.worker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;

      worker.onmessage = (event: MessageEvent) => {
        const msg = event.data;

        if (msg.type === "progress") {
          setProgress(msg.progress);
          setStatus(msg.status as SifParseStatus);
        } else if (msg.type === "result") {
          setResult(msg.data);
          setStatus("done");
          setProgress(100);
          worker.terminate();
          workerRef.current = null;
        } else if (msg.type === "error") {
          setError(msg.message);
          setStatus("error");
          worker.terminate();
          workerRef.current = null;
        }
      };

      worker.onerror = (err) => {
        setError(err.message || "Worker error");
        setStatus("error");
        worker.terminate();
        workerRef.current = null;
      };

      worker.postMessage({ type: "parse", content, fileName: file.name });
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to read file");
      setStatus("error");
    });
  }, []);

  const reset = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setResult(null);
    setProgress(0);
    setStatus("idle");
    setError(null);
  }, []);

  return { parse, result, progress, status, error, reset };
}
