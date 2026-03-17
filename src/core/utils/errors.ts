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
