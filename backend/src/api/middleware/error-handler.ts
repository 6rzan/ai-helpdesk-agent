import type { NextFunction, Request, Response } from "express";
import { isAppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (isAppError(err)) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.path }, "request failed");
    }
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message }, ...(err.details ?? {}) });
    return;
  }

  logger.error({ err, path: req.path }, "unhandled error");
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` } });
}
