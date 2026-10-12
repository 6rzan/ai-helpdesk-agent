import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../../lib/errors.js";

// VIVA_STAFF_ACCESS: Backend role check is the access boundary; hiding a React route alone is insufficient.
export function requireStaff(req: Request, _res: Response, next: NextFunction): void {
  if (!req.account || req.account.role !== "staff") {
    next(new ForbiddenError("Staff access is required for this action.", "FORBIDDEN"));
    return;
  }
  next();
}
