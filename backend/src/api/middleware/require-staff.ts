import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../../lib/errors.js";

export function requireStaff(req: Request, _res: Response, next: NextFunction): void {
  if (!req.account || req.account.role !== "staff") {
    next(new ForbiddenError("Staff access is required for this action.", "FORBIDDEN"));
    return;
  }
  next();
}
