/**
 * Unit tests for API error handler middleware.
 * Tests error-to-HTTP-status mapping for all 6 error types + generic errors.
 */
import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../api/middleware/error-handler.js";
import {
  McpGraphError,
  GraphNotInitializedError,
  NodeNotFoundError,
  FileNotFoundError,
  SnapshotNotFoundError,
  ValidationError,
} from "../core/utils/errors.js";
import { z } from "zod/v4";

function createMockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

const mockReq = {} as Request;
const mockNext: NextFunction = vi.fn();

describe("errorHandler middleware", () => {
  it("should map GraphNotInitializedError to 409", () => {
    const res = createMockRes();
    errorHandler(new GraphNotInitializedError(), mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
  });

  it("should map NodeNotFoundError to 404", () => {
    const res = createMockRes();
    errorHandler(new NodeNotFoundError("node_abc123"), mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("node_abc123") }),
    );
  });

  it("should map FileNotFoundError to 404", () => {
    const res = createMockRes();
    errorHandler(new FileNotFoundError("/tmp/missing.md"), mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("should map SnapshotNotFoundError to 404", () => {
    const res = createMockRes();
    errorHandler(new SnapshotNotFoundError(42), mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("should map ValidationError to 400 with details", () => {
    const issues = [{ field: "title", message: "required" }];
    const res = createMockRes();
    errorHandler(new ValidationError("bad input", issues), mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ details: issues }),
    );
  });

  it("should map ZodError to 400 with details", () => {
    const schema = z.object({ name: z.string() });
    let zodError: z.ZodError;
    try {
      schema.parse({ name: 123 });
    } catch (e) {
      zodError = e as z.ZodError;
    }

    const res = createMockRes();
    errorHandler(zodError!, mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.any(Array) }),
    );
  });

  it("should map generic McpGraphError to 400", () => {
    const res = createMockRes();
    errorHandler(new McpGraphError("something wrong"), mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should map unknown Error to 500", () => {
    const res = createMockRes();
    errorHandler(new Error("unexpected"), mockReq, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
