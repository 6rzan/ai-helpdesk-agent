export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  /** Extra fields merged into the top level of the JSON error response (e.g. the
   * current assignee on a takeover conflict). */
  readonly details?: Record<string, unknown>;

  constructor(statusCode: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code = "VALIDATION_ERROR") {
    super(400, code, message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, code = "NOT_FOUND") {
    super(404, code, message);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string, code = "FORBIDDEN") {
    super(403, code, message);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = "CONFLICT", details?: Record<string, unknown>) {
    super(409, code, message, details);
    this.name = "ConflictError";
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string, code = "SERVICE_UNAVAILABLE") {
    super(503, code, message);
    this.name = "ServiceUnavailableError";
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message: string, code = "PAYLOAD_TOO_LARGE") {
    super(413, code, message);
    this.name = "PayloadTooLargeError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string, code = "UNAUTHORIZED") {
    super(401, code, message);
    this.name = "UnauthorizedError";
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string, code = "UNPROCESSABLE_ENTITY") {
    super(422, code, message);
    this.name = "UnprocessableEntityError";
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
