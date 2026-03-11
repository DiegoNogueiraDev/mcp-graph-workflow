import type { LogEntry, LogLevel } from "../../schemas/log.schema.js";

const MAX_BUFFER_SIZE = 1000;

const logBuffer: LogEntry[] = [];
let nextId = 1;
let logListener: ((entry: LogEntry) => void) | null = null;

function appendToBuffer(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    id: nextId++,
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
  };

  logBuffer.push(entry);

  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.splice(0, logBuffer.length - MAX_BUFFER_SIZE);
  }

  if (logListener) {
    logListener(entry);
  }
}

export function getLogBuffer(): LogEntry[] {
  return [...logBuffer];
}

export function clearLogBuffer(): void {
  logBuffer.length = 0;
}

export function setLogListener(listener: ((entry: LogEntry) => void) | null): void {
  logListener = listener;
}

function formatCtx(ctx?: Record<string, unknown>): string {
  if (!ctx || Object.keys(ctx).length === 0) return "";
  return (
    " " +
    Object.entries(ctx)
      .map(([k, v]) => `${k}="${String(v)}"`)
      .join(" ")
  );
}

export const logger = {
  info(msg: string, ctx?: Record<string, unknown>): void {
    appendToBuffer("info", msg, ctx);
    console.error(`[INFO] ${msg}${formatCtx(ctx)}`);
  },
  warn(msg: string, ctx?: Record<string, unknown>): void {
    appendToBuffer("warn", msg, ctx);
    console.error(`[WARN] ${msg}${formatCtx(ctx)}`);
  },
  error(msg: string, ctx?: Record<string, unknown>): void {
    appendToBuffer("error", msg, ctx);
    console.error(`[ERROR] ${msg}${formatCtx(ctx)}`);
  },
  success(msg: string, ctx?: Record<string, unknown>): void {
    appendToBuffer("success", msg, ctx);
    console.error(`[OK] ${msg}${formatCtx(ctx)}`);
  },
  debug(msg: string, ctx?: Record<string, unknown>): void {
    if (process.env.MCP_GRAPH_DEBUG) {
      appendToBuffer("debug", msg, ctx);
      console.error(`[DEBUG] ${msg}${formatCtx(ctx)}`);
    }
  },
};
