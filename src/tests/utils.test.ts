/**
 * Unit tests for core utility modules: id, time, errors.
 */
import { describe, it, expect } from "vitest";
import { generateId } from "../core/utils/id.js";
import { now } from "../core/utils/time.js";
import {
  McpGraphError,
  NodeNotFoundError,
  FileNotFoundError,
  GraphNotInitializedError,
  ValidationError,
  SnapshotNotFoundError,
} from "../core/utils/errors.js";

describe("generateId", () => {
  it("should return string with default 'node' prefix", () => {
    const id = generateId();
    expect(id).toMatch(/^node_/);
  });

  it("should return string with custom prefix", () => {
    const id = generateId("edge");
    expect(id).toMatch(/^edge_/);
  });

  it("should produce unique IDs across 100 calls", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it("should follow format prefix_12hexchars", () => {
    const id = generateId("test");
    expect(id).toMatch(/^test_[0-9a-f]{12}$/);
  });
});

describe("now", () => {
  it("should return ISO 8601 string", () => {
    const result = now();
    expect(() => new Date(result)).not.toThrow();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe("Error classes", () => {
  it("McpGraphError sets correct name property", () => {
    const err = new McpGraphError("test");
    expect(err.name).toBe("McpGraphError");
    expect(err.message).toBe("test");
  });

  it("NodeNotFoundError includes node ID in message", () => {
    const err = new NodeNotFoundError("node_abc");
    expect(err.message).toContain("node_abc");
    expect(err.name).toBe("NodeNotFoundError");
  });

  it("all error classes extend McpGraphError", () => {
    expect(new NodeNotFoundError("x")).toBeInstanceOf(McpGraphError);
    expect(new FileNotFoundError("/f")).toBeInstanceOf(McpGraphError);
    expect(new GraphNotInitializedError()).toBeInstanceOf(McpGraphError);
    expect(new ValidationError("v", [])).toBeInstanceOf(McpGraphError);
    expect(new SnapshotNotFoundError(1)).toBeInstanceOf(McpGraphError);
  });
});
