import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod/v4";
import { z } from "zod/v4";
import { ValidationError } from "../../core/utils/errors.js";

export function validateBody(schema: ZodType): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError("Invalid request body", result.error.issues));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodType): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new ValidationError("Invalid query parameters", result.error.issues));
      return;
    }
    next();
  };
}
