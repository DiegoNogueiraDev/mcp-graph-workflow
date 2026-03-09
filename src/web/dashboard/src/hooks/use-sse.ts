import { useEffect, useRef, useCallback } from "react";

type SSEEvent =
  | "node:created"
  | "node:updated"
  | "node:deleted"
  | "edge:created"
  | "edge:deleted"
  | "import:completed";

export function useSSE(onEvent: (event: SSEEvent, data: unknown) => void): void {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  const connect = useCallback(() => {
    const es = new EventSource("/api/v1/events");

    const handler = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        callbackRef.current(e.type as SSEEvent, data);
      } catch {
        // ignore parse errors
      }
    };

    const events: SSEEvent[] = [
      "node:created", "node:updated", "node:deleted",
      "edge:created", "edge:deleted", "import:completed",
    ];

    for (const evt of events) {
      es.addEventListener(evt, handler);
    }

    // Also handle generic "message" events
    es.onmessage = handler;

    es.onerror = () => {
      es.close();
      // Auto-reconnect after 5s
      setTimeout(connect, 5000);
    };

    return es;
  }, []);

  useEffect(() => {
    const es = connect();
    return () => es.close();
  }, [connect]);
}
