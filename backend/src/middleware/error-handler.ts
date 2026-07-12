import type { ErrorRequestHandler } from "express";
import type { Logger } from "pino";
import { treeifyError, ZodError } from "zod";
import { AppError } from "../shared/errors/app-error.js";
import { errorEnvelope } from "../shared/http/envelope.js";

export function createErrorHandler(logger: Logger, exposeInternalErrors: boolean): ErrorRequestHandler {
  return (error: unknown, request, response, _next) => {
    void _next;
    const validationError = error instanceof ZodError ? error : undefined;
    const appError = error instanceof AppError ? error : undefined;
    const statusCode = validationError === undefined ? appError?.statusCode ?? 500 : 422;
    const code = validationError === undefined ? appError?.code ?? "INTERNAL_ERROR" : "VALIDATION_ERROR";
    const publicMessage = validationError === undefined ? appError?.message ?? "An unexpected error occurred" : "Request validation failed";

    if (statusCode >= 500) logger.error({ err: error, requestId: request.requestId }, "Request failed");
    else logger.warn({ err: error, requestId: request.requestId }, "Request rejected");

    const details = validationError === undefined ? appError?.details ?? (
      exposeInternalErrors && error instanceof Error ? { reason: error.message } : undefined
    ) : { fields: treeifyError(validationError) };
    response.status(statusCode).json(errorEnvelope(code, publicMessage, request.requestId, details));
  };
}
