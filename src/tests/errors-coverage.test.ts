import { describe, it, expect } from "vitest";
import {
  McpGraphError,
  FileNotFoundError,
  GraphNotInitializedError,
  NodeNotFoundError,
  ValidationError,
  SnapshotNotFoundError,
  LifecycleGateError,
} from "../core/utils/errors.js";

describe("McpGraphError", () => {
  it("should set name and message", () => {
    const err = new McpGraphError("something went wrong");

    expect(err.name).toBe("McpGraphError");
    expect(err.message).toBe("something went wrong");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(McpGraphError);
  });
});

describe("FileNotFoundError", () => {
  it("should include the file path in message", () => {
    const err = new FileNotFoundError("/tmp/missing.txt");

    expect(err.name).toBe("FileNotFoundError");
    expect(err.message).toBe("File not found: /tmp/missing.txt");
    expect(err).toBeInstanceOf(McpGraphError);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("GraphNotInitializedError", () => {
  it("should have a fixed message about running init", () => {
    const err = new GraphNotInitializedError();

    expect(err.name).toBe("GraphNotInitializedError");
    expect(err.message).toContain("Graph not initialized");
    expect(err.message).toContain("mcp-graph init");
    expect(err).toBeInstanceOf(McpGraphError);
  });
});

describe("NodeNotFoundError", () => {
  it("should include the node id in message", () => {
    const err = new NodeNotFoundError("node_abc123");

    expect(err.name).toBe("NodeNotFoundError");
    expect(err.message).toBe("Node not found: node_abc123");
    expect(err).toBeInstanceOf(McpGraphError);
  });
});

describe("ValidationError", () => {
  it("should include message and issues array", () => {
    const issues = [{ field: "title", error: "required" }];
    const err = new ValidationError("title is required", issues);

    expect(err.name).toBe("ValidationError");
    expect(err.message).toBe("Validation failed: title is required");
    expect(err.issues).toEqual(issues);
    expect(err).toBeInstanceOf(McpGraphError);
  });

  it("should accept empty issues array", () => {
    const err = new ValidationError("generic error", []);

    expect(err.issues).toEqual([]);
    expect(err.message).toContain("generic error");
  });

  it("should preserve issues with multiple entries", () => {
    const issues = [
      { field: "name", error: "too short" },
      { field: "email", error: "invalid format" },
    ];
    const err = new ValidationError("multiple fields invalid", issues);

    expect(err.issues).toHaveLength(2);
    expect(err.issues[0]).toEqual({ field: "name", error: "too short" });
  });
});

describe("SnapshotNotFoundError", () => {
  it("should include the snapshot id in message", () => {
    const err = new SnapshotNotFoundError(42);

    expect(err.name).toBe("SnapshotNotFoundError");
    expect(err.message).toBe("Snapshot not found: 42");
    expect(err).toBeInstanceOf(McpGraphError);
  });
});

describe("LifecycleGateError", () => {
  it("should include toolName, currentPhase, reason, and unmetConditions", () => {
    const err = new LifecycleGateError(
      "deploy",
      "IMPLEMENT",
      "not all tests passing",
      ["tests_pass", "lint_clean"],
    );

    expect(err.name).toBe("LifecycleGateError");
    expect(err.message).toContain("deploy");
    expect(err.message).toContain("IMPLEMENT");
    expect(err.message).toContain("not all tests passing");
    expect(err.toolName).toBe("deploy");
    expect(err.currentPhase).toBe("IMPLEMENT");
    expect(err.reason).toBe("not all tests passing");
    expect(err.unmetConditions).toEqual(["tests_pass", "lint_clean"]);
    expect(err).toBeInstanceOf(McpGraphError);
  });

  it("should work with empty unmetConditions", () => {
    const err = new LifecycleGateError("build", "PLAN", "phase not ready", []);

    expect(err.unmetConditions).toEqual([]);
    expect(err.message).toContain("build");
  });
});
