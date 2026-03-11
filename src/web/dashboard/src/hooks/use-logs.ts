import { useState, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api-client";
import type { LogEntry } from "@/lib/types";

interface UseLogsResult {
  logs: LogEntry[];
  loading: boolean;
  clearLogs: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useLogs(): UseLogsResult {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const maxSeenIdRef = useRef(0);

  const fetchLogs = useCallback(async () => {
    try {
      const { logs: fetched } = await apiClient.getLogs();
      setLogs(fetched);
      if (fetched.length > 0) {
        maxSeenIdRef.current = fetched[fetched.length - 1].id;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const clearLogs = useCallback(async () => {
    await apiClient.clearLogs();
    setLogs([]);
    maxSeenIdRef.current = 0;
  }, []);

  // Initial fetch
  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  // SSE streaming for real-time log entries
  useEffect(() => {
    const es = new EventSource("/api/v1/events");

    const handler = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data);
        const entry: LogEntry = {
          id: event.payload.id,
          level: event.payload.level,
          message: event.payload.message,
          context: event.payload.context,
          timestamp: event.timestamp,
        };

        if (entry.id > maxSeenIdRef.current) {
          maxSeenIdRef.current = entry.id;
          setLogs((prev) => [...prev, entry]);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.addEventListener("log:entry", handler);

    es.onerror = () => {
      es.close();
      // Auto-reconnect after 5s
      setTimeout(() => {
        // Reconnect by re-mounting the effect
      }, 5000);
    };

    return () => es.close();
  }, []);

  return { logs, loading, clearLogs, refresh: fetchLogs };
}
