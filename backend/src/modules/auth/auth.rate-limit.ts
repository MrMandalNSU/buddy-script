import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { ipKeyGenerator, rateLimit, type RateLimitRequestHandler } from "express-rate-limit";
import { errorEnvelope } from "../../shared/http/envelope.js";

type KeyGenerator = (request: Request, response: Response) => string | Promise<string>;

function emailKey(request: Request): string {
  const body: unknown = request.body;
  const email = typeof body === "object" && body !== null && "email" in body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "unknown";
  return `${ipKeyGenerator(request.ip ?? "unknown")}:${createHash("sha256").update(email).digest("hex").slice(0, 16)}`;
}

function limiter(windowMs: number, limit: number, keyGenerator?: KeyGenerator): RateLimitRequestHandler {
  return rateLimit({
    windowMs, limit, standardHeaders: "draft-8", legacyHeaders: false,
    ...(keyGenerator === undefined ? {} : { keyGenerator }),
    handler: (request, response) => response.status(429).json(errorEnvelope("RATE_LIMITED", "Too many requests. Please try again later.", request.requestId)),
  });
}

export const registrationRateLimit = limiter(60 * 60 * 1000, 5, emailKey);
export const loginRateLimit = limiter(15 * 60 * 1000, 10, emailKey);
export const refreshRateLimit = limiter(15 * 60 * 1000, 60);
