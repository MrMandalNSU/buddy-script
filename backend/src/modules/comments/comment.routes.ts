import { Router } from "express";
import type { Environment } from "../../config/env.js";
import type { DatabaseClient } from "../../infrastructure/database/client.js";
import { asyncHandler } from "../../shared/http/async-handler.js";
import { validateBody, validateParams, validateQuery } from "../../shared/http/validate.js";
import { CursorService } from "../../shared/pagination/cursor.service.js";
import { createTokenService } from "../auth/auth.factory.js";
import { authenticateAccess, requireAccessCsrf } from "../auth/auth.middleware.js";
import { AuthCookieService } from "../auth/cookie.service.js";
import { pageQuerySchema } from "../posts/post.schemas.js";
import { CommentController } from "./comment.controller.js";
import { commentCreationRateLimit, commentReactionRateLimit } from "./comment.rate-limit.js";
import { CommentRepository } from "./comment.repository.js";
import { commentBodySchema, commentParamsSchema, postCommentParamsSchema } from "./comment.schemas.js";
import { CommentService } from "./comment.service.js";

export function createCommentRouter(database: DatabaseClient, environment: Environment): Router {
  if (environment.cursorSigningSecret === undefined) throw new Error("CURSOR_SIGNING_SECRET is required");
  const tokens = createTokenService(environment); const cookies = new AuthCookieService(environment);
  const controller = new CommentController(new CommentService(new CommentRepository(database), new CursorService(environment.cursorSigningSecret)));
  const router = Router(); const authenticate = authenticateAccess(tokens, cookies);
  router.get("/posts/:postId/comments", authenticate, validateParams(postCommentParamsSchema), validateQuery(pageQuerySchema), asyncHandler(controller.listComments));
  router.post("/posts/:postId/comments", authenticate, commentCreationRateLimit, requireAccessCsrf(cookies), validateParams(postCommentParamsSchema), validateBody(commentBodySchema), asyncHandler(controller.createComment));
  router.get("/comments/:commentId/replies", authenticate, validateParams(commentParamsSchema), validateQuery(pageQuerySchema), asyncHandler(controller.listReplies));
  router.post("/comments/:commentId/replies", authenticate, commentCreationRateLimit, requireAccessCsrf(cookies), validateParams(commentParamsSchema), validateBody(commentBodySchema), asyncHandler(controller.createReply));
  router.post("/comments/:commentId/like", authenticate, commentReactionRateLimit, requireAccessCsrf(cookies), validateParams(commentParamsSchema), asyncHandler(controller.like));
  router.delete("/comments/:commentId/like", authenticate, commentReactionRateLimit, requireAccessCsrf(cookies), validateParams(commentParamsSchema), asyncHandler(controller.unlike));
  router.get("/comments/:commentId/likers", authenticate, validateParams(commentParamsSchema), validateQuery(pageQuerySchema), asyncHandler(controller.likers));
  return router;
}
