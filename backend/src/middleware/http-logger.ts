import type { IncomingMessage } from "node:http";
import type { RequestHandler } from "express";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";

type CorrelatedRequest = IncomingMessage & { requestId?: string };

export function createHttpLogger(logger: Logger): RequestHandler {
  return pinoHttp<CorrelatedRequest>({
    logger,
    genReqId: (request) => request.requestId ?? "unassigned",
    customProps: (request) => ({ requestId: request.requestId }),
    customLogLevel: (_request, response, error) => {
      if (error !== undefined || response.statusCode >= 500) return "error";
      if (response.statusCode >= 400) return "warn";
      return "info";
    },
  });
}
