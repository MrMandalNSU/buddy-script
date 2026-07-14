import type { Request, Response } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { successEnvelope } from "../../shared/http/envelope.js";
import type { PageQuery } from "../posts/post.schemas.js";
import type { CommentBodyRequest, CommentReactionBodyRequest } from "./comment.schemas.js";
import type { CommentService } from "./comment.service.js";

export class CommentController {
  constructor(readonly service: CommentService) {}
  listComments = async (request: Request, response: Response): Promise<void> => {
    response.json(successEnvelope(await this.service.listComments(userId(request), parameter(request, "postId"), request.query as unknown as PageQuery), request.requestId));
  };
  createComment = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(successEnvelope(await this.service.createComment(userId(request), parameter(request, "postId"), (request.body as CommentBodyRequest).body), request.requestId));
  };
  listReplies = async (request: Request, response: Response): Promise<void> => {
    response.json(successEnvelope(await this.service.listReplies(userId(request), parameter(request, "commentId"), request.query as unknown as PageQuery), request.requestId));
  };
  createReply = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(successEnvelope(await this.service.createReply(userId(request), parameter(request, "commentId"), (request.body as CommentBodyRequest).body), request.requestId));
  };
  update = async (request: Request, response: Response): Promise<void> => {
    response.json(successEnvelope(await this.service.update(userId(request), parameter(request, "commentId"), (request.body as CommentBodyRequest).body), request.requestId));
  };
  delete = async (request: Request, response: Response): Promise<void> => {
    await this.service.delete(userId(request), parameter(request, "commentId"));
    response.status(204).send();
  };
  like = async (request: Request, response: Response): Promise<void> => {
    response.json(successEnvelope(await this.service.setLike(userId(request), parameter(request, "commentId"), true), request.requestId));
  };
  unlike = async (request: Request, response: Response): Promise<void> => {
    response.json(successEnvelope(await this.service.setLike(userId(request), parameter(request, "commentId"), false), request.requestId));
  };
  react = async (request: Request, response: Response): Promise<void> => {
    response.json(successEnvelope(await this.service.setReaction(userId(request), parameter(request, "commentId"), request.body as CommentReactionBodyRequest), request.requestId));
  };
  unreact = async (request: Request, response: Response): Promise<void> => {
    response.json(successEnvelope(await this.service.setReaction(userId(request), parameter(request, "commentId"), null), request.requestId));
  };
  likers = async (request: Request, response: Response): Promise<void> => {
    response.json(successEnvelope(await this.service.likers(userId(request), parameter(request, "commentId"), request.query as unknown as PageQuery), request.requestId));
  };
  reactors = async (request: Request, response: Response): Promise<void> => {
    response.json(successEnvelope(await this.service.reactors(userId(request), parameter(request, "commentId"), request.query as unknown as PageQuery), request.requestId));
  };
}

function userId(request: Request): string {
  if (request.auth === undefined) throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  return request.auth.userId;
}
function parameter(request: Request, name: "postId" | "commentId"): string {
  const value = request.params[name];
  if (typeof value !== "string") throw new AppError(400, "BAD_REQUEST", `${name} is invalid`);
  return value;
}
