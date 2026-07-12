import type { RequestHandler } from "express";
import type { Environment } from "../config/env.js";
import { AppError } from "../shared/errors/app-error.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function createOriginGuard(environment: Environment): RequestHandler {
  return (request, _response, next) => {
    if (safeMethods.has(request.method) || environment.nodeEnv === "test") return next();
    const origin = request.header("origin");
    const referer = request.header("referer");
    let source: string | undefined = origin;
    if (source === undefined && referer !== undefined) {
      try { source = new URL(referer).origin; } catch { source = undefined; }
    }
    if (source === undefined || !environment.allowedOrigins.has(source)) return next(new AppError(403, "FORBIDDEN", "Request origin is not allowed"));
    next();
  };
}
