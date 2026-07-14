import type { Request, Response } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { successEnvelope } from "../../shared/http/envelope.js";
import type { CreatePostRequest, PageQuery, ReactionBodyRequest, UpdatePostRequest } from "./post.schemas.js";
import type { PostService } from "./post.service.js";

export class PostController {
  constructor(readonly service: PostService) {}
  list = async (request: Request, response: Response): Promise<void> => {
    response.json(successEnvelope(await this.service.list(userId(request), request.query as unknown as PageQuery), request.requestId));
  };
  create = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(successEnvelope(await this.service.create(userId(request), request.body as CreatePostRequest), request.requestId));
  };
  update = async (request: Request, response: Response): Promise<void> => {
    response.json(successEnvelope(await this.service.update(userId(request), postId(request), request.body as UpdatePostRequest), request.requestId));
  };
  delete = async (request: Request, response: Response): Promise<void> => {
    await this.service.delete(userId(request), postId(request));
    response.status(204).end();
  };
  like = async (request: Request, response: Response): Promise<void> => {
    response.json(successEnvelope(await this.service.setLike(userId(request), postId(request), true), request.requestId));
  };
  unlike = async (request: Request, response: Response): Promise<void> => {
    response.json(successEnvelope(await this.service.setLike(userId(request), postId(request), false), request.requestId));
  };
  react = async (request: Request, response: Response): Promise<void> => {
    response.json(successEnvelope(await this.service.setReaction(userId(request), postId(request), request.body as ReactionBodyRequest), request.requestId));
  };
  unreact = async (request: Request, response: Response): Promise<void> => {
    response.json(successEnvelope(await this.service.setReaction(userId(request), postId(request), null), request.requestId));
  };
  likers = async (request: Request, response: Response): Promise<void> => {
    response.json(successEnvelope(await this.service.likers(userId(request), postId(request), request.query as unknown as PageQuery), request.requestId));
  };
  reactors = async (request: Request, response: Response): Promise<void> => {
    response.json(successEnvelope(await this.service.reactors(userId(request), postId(request), request.query as unknown as PageQuery), request.requestId));
  };
}
function postId(request: Request): string {
  const value = request.params.postId;
  if (typeof value !== "string") throw new AppError(400, "BAD_REQUEST", "Post ID is invalid");
  return value;
}

function userId(request: Request): string {
  if (request.auth === undefined) throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
  return request.auth.userId;
}
