import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import type { Environment } from "../../config/env.js";
import { errorEnvelope } from "../../shared/http/envelope.js";
import { createTokenService } from "../auth/auth.factory.js";
import { authenticateAccess, requireAccessCsrf } from "../auth/auth.middleware.js";
import { AuthCookieService } from "../auth/cookie.service.js";
import type { CloudinaryService } from "./cloudinary.service.js";
import { UploadController } from "./upload.controller.js";

export function createUploadRouter(cloudinary: CloudinaryService, environment: Environment): Router {
  const tokens = createTokenService(environment); const cookies = new AuthCookieService(environment); const controller = new UploadController(cloudinary);
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false,
    handler: (request, response) => response.status(429).json(errorEnvelope("RATE_LIMITED", "Too many requests. Please try again later.", request.requestId)),
  });
  const router = Router();
  router.post("/signature", authenticateAccess(tokens, cookies), limiter, requireAccessCsrf(cookies), controller.signature);
  return router;
}
