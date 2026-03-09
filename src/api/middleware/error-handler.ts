import type { Request, Response, NextFunction } from "express";
import { z } from "zod/v4";
import {
  McpGraphError,
  GraphNotInitializedError,
  NodeNotFoundError,
  ValidationError,
  SnapshotNotFoundError,
  FileNotFoundError,
} from "../../core/utils/errors.js";
import { logger } from "../../core/utils/logger.js";

interface ErrorResponseBody {
  error: string;
  details?: unknown;
}

function mapErrorToStatus(err: Error): number {
  if (err instanceof GraphNotInitializedError) return 409;
  if (err instanceof NodeNotFoundError) return 404;
  if (err instanceof FileNotFoundError) return 404;
  if (err instanceof SnapshotNotFoundError) return 404;
  if (err instanceof ValidationError) return 400;
  if (err instanceof z.ZodError) return 400;
  if (err instanceof McpGraphError) return 400;
  return 500;
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = mapErrorToStatus(err);
  const body: ErrorResponseBody = { error: err.message };

  if (err instanceof ValidationError) {
    body.details = err.issues;
  } else if (err instanceof z.ZodError) {
    body.details = err.issues;
  }

  if (status >= 500) {
    logger.error("Unhandled API error", { error: err.message, stack: err.stack });
  }

  res.status(status).json(body);
}
