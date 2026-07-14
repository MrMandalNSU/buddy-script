import { Router } from "express";
import type { Environment } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/client.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { validateBody, validateParams, validateQuery } from "../../shared/http/validate.js";
import { CursorService } from "../../shared/pagination/cursor.service.js";
import { createTokenService } from "../auth/auth.factory.js";
import { authenticateAccess, requireAccessCsrf } from "../auth/auth.middleware.js";
import { AuthCookieService } from "../auth/cookie.service.js";
import { PostController } from "./post.controller.js";
import { postCreationRateLimit, postReactionRateLimit } from "./post.rate-limit.js";
import { PostRepository } from "./post.repository.js";
import { createPostSchema, pageQuerySchema, postParamsSchema, reactionBodySchema, updatePostSchema } from "./post.schemas.js";
import { PostService } from "./post.service.js";
import type { CachePort } from "../../infrastructure/cache/cache.port.js";
import type { CloudinaryService } from "../uploads/cloudinary.service.js";
import type { Logger } from "pino";

export function createPostRouter(database: DatabaseClient, environment: Environment, cloudinary?: CloudinaryService, cache?: CachePort, logger?: Pick<Logger, "warn">): Router {
  if (environment.cursorSigningSecret === undefined) throw new Error("CURSOR_SIGNING_SECRET is required");
  const tokens = createTokenService(environment); const cookies = new AuthCookieService(environment);
  const controller = new PostController(new PostService(
    new PostRepository(database), new CursorService(environment.cursorSigningSecret), cloudinary, cache, environment.cachePublicFeedTtlSeconds, logger,
  ));
  const router = Router();
  router.use(authenticateAccess(tokens, cookies));
  router.get("/", validateQuery(pageQuerySchema), asyncHandler(controller.list));
  router.post("/", postCreationRateLimit, requireAccessCsrf(cookies), validateBody(createPostSchema), asyncHandler(controller.create));
  router.patch("/:postId", postCreationRateLimit, requireAccessCsrf(cookies), validateParams(postParamsSchema), validateBody(updatePostSchema), asyncHandler(controller.update));
  router.delete("/:postId", postCreationRateLimit, requireAccessCsrf(cookies), validateParams(postParamsSchema), asyncHandler(controller.delete));
  router.post("/:postId/like", postReactionRateLimit, requireAccessCsrf(cookies), validateParams(postParamsSchema), asyncHandler(controller.like));
  router.delete("/:postId/like", postReactionRateLimit, requireAccessCsrf(cookies), validateParams(postParamsSchema), asyncHandler(controller.unlike));
  router.get("/:postId/likers", validateParams(postParamsSchema), validateQuery(pageQuerySchema), asyncHandler(controller.likers));
  router.put("/:postId/reaction", postReactionRateLimit, requireAccessCsrf(cookies), validateParams(postParamsSchema), validateBody(reactionBodySchema), asyncHandler(controller.react));
  router.delete("/:postId/reaction", postReactionRateLimit, requireAccessCsrf(cookies), validateParams(postParamsSchema), asyncHandler(controller.unreact));
  router.get("/:postId/reactors", validateParams(postParamsSchema), validateQuery(pageQuerySchema), asyncHandler(controller.reactors));
  return router;
}
