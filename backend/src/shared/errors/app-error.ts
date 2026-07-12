export type ErrorCode =
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "INTERNAL_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR";

export class AppError extends Error {
  readonly isOperational = true;

  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AppError";
  }
}
