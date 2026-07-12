import { rateLimit } from "express-rate-limit";
import { errorEnvelope } from "../../shared/http/envelope.js";

function limiter(limit: number, windowMs: number) {
  return rateLimit({
    limit, windowMs, standardHeaders: "draft-8", legacyHeaders: false,
    handler: (request, response) => response.status(429).json(errorEnvelope("RATE_LIMITED", "Too many requests. Please try again later.", request.requestId)),
  });
}
export const commentCreationRateLimit = limiter(120, 60 * 60 * 1_000);
export const commentReactionRateLimit = limiter(300, 15 * 60 * 1_000);
