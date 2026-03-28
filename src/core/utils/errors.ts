export class McpGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpGraphError";
  }
}

export class FileNotFoundError extends McpGraphError {
  constructor(path: string) {
    super(`File not found: ${path}`);
    this.name = "FileNotFoundError";
  }
}

export class GraphNotInitializedError extends McpGraphError {
  constructor() {
    super("Graph not initialized. Run 'mcp-graph init' first.");
    this.name = "GraphNotInitializedError";
  }
}

export class NodeNotFoundError extends McpGraphError {
  constructor(id: string) {
    super(`Node not found: ${id}`);
    this.name = "NodeNotFoundError";
  }
}

export class ValidationError extends McpGraphError {
  constructor(message: string, public readonly issues: unknown[]) {
    super(`Validation failed: ${message}`);
    this.name = "ValidationError";
  }
}

export class SnapshotNotFoundError extends McpGraphError {
  constructor(id: number) {
    super(`Snapshot not found: ${id}`);
    this.name = "SnapshotNotFoundError";
  }
}

/** Safely extract an error message from an unknown thrown value. */
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ── Translation errors ──

export class TranslationError extends McpGraphError {
  constructor(message: string) {
    super(`Translation error: ${message}`);
    this.name = "TranslationError";
  }
}

export class UnsupportedLanguagePairError extends McpGraphError {
  constructor(
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Unsupported language pair: ${from} → ${to}`);
    this.name = "UnsupportedLanguagePairError";
  }
}

export class TranslationValidationError extends McpGraphError {
  constructor(
    public readonly jobId: string,
    message: string,
  ) {
    super(`Translation validation failed for job ${jobId}: ${message}`);
    this.name = "TranslationValidationError";
  }
}

export class LifecycleGateError extends McpGraphError {
  constructor(
    public readonly toolName: string,
    public readonly currentPhase: string,
    public readonly reason: string,
    public readonly unmetConditions: string[],
  ) {
    super(`Lifecycle gate: "${toolName}" blocked in ${currentPhase} — ${reason}`);
    this.name = "LifecycleGateError";
  }
}
