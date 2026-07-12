import { Router } from "express";
import type { Environment } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/client.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { validateBody } from "../../shared/http/validate.js";
import { AuthController } from "./auth.controller.js";
import { authenticateAccess, authenticateRefresh, requireAccessCsrf, requireRefreshCsrf } from "./auth.middleware.js";
import { loginRateLimit, refreshRateLimit, registrationRateLimit } from "./auth.rate-limit.js";
import { AuthRepository } from "./auth.repository.js";
import { loginSchema, registerSchema } from "./auth.schemas.js";
import { AuthService } from "./auth.service.js";
import { AuthCookieService } from "./cookie.service.js";
import { createTokenService } from "./auth.factory.js";

export function createAuthRouter(database: DatabaseClient, environment: Environment): Router {
  const tokens = createTokenService(environment);
  const cookies = new AuthCookieService(environment);
  const controller = new AuthController(new AuthService(new AuthRepository(database), tokens), cookies);
  const router = Router();
  router.post("/register", registrationRateLimit, validateBody(registerSchema), asyncHandler(controller.register));
  router.post("/login", loginRateLimit, validateBody(loginSchema), asyncHandler(controller.login));
  router.post("/refresh", refreshRateLimit, authenticateRefresh(tokens, cookies), requireRefreshCsrf(cookies), asyncHandler(controller.refresh));
  router.post("/logout", authenticateRefresh(tokens, cookies), requireRefreshCsrf(cookies), asyncHandler(controller.logout));
  router.post("/logout-all", authenticateAccess(tokens, cookies), requireAccessCsrf(cookies), asyncHandler(controller.logoutAll));
  router.get("/me", authenticateAccess(tokens, cookies), asyncHandler(controller.me));
  return router;
}
