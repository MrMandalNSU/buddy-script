import { normalizePageLimit, takePage } from "../../infrastructure/database/pagination.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CursorService, TimelineCursor } from "../../shared/pagination/cursor.service.js";
import type { PageQuery } from "../posts/post.schemas.js";
import { commentDto } from "./comment.dto.js";
import type { CommentLikerRecord, CommentRecord } from "./comment.types.js";
import type { CommentRepository } from "./comment.repository.js";
import type { CommentReactionBodyRequest } from "./comment.schemas.js";
import { ReactionType } from "../../generated/prisma/client.js";
import { reactionBreakdownDto, reactionValue, toReactionType } from "../posts/reaction.dto.js";

export class CommentService {
  constructor(readonly repository: CommentRepository, readonly cursors: CursorService) {}

  async listComments(viewerId: string, postId: string, query: PageQuery) {
    const limit = normalizePageLimit(query.limit); const rows = await this.repository.listRoots(postId, viewerId, this.decode(query.cursor), limit + 1);
    if (rows === null) throw notFound("Post");
    return this.page(rows, limit);
  }

  async createComment(viewerId: string, postId: string, body: string) {
    const comment = await this.repository.createRoot(postId, viewerId, body.trim());
    if (comment === null) throw notFound("Post");
    return commentDto(comment);
  }

  async listReplies(viewerId: string, commentId: string, query: PageQuery) {
    const limit = normalizePageLimit(query.limit); const result = await this.repository.listReplies(commentId, viewerId, this.decode(query.cursor), limit + 1);
    if (result === null) throw notFound("Comment");
    if (result.parentDepth !== 0) throw nestedReplyError();
    return this.page(result.rows, limit);
  }

  async createReply(viewerId: string, commentId: string, body: string) {
    const result = await this.repository.createReply(commentId, viewerId, body.trim());
    if (result === null) throw notFound("Comment");
    if (result.parentDepth !== 0 || result.reply === undefined) throw nestedReplyError();
    return commentDto(result.reply);
  }

  async update(viewerId: string, commentId: string, body: string) {
    const result = await this.repository.update(commentId, viewerId, body.trim());
    if (result.status === "not-found") throw notFound("Comment");
    if (result.status === "forbidden") throw forbidden();
    if (result.status !== "updated") throw new Error("Comment update returned an invalid result");
    return commentDto(result.comment);
  }

  async delete(viewerId: string, commentId: string) {
    const result = await this.repository.delete(commentId, viewerId);
    if (result.status === "not-found") throw notFound("Comment");
    if (result.status === "forbidden") throw forbidden();
    if (result.status !== "deleted") throw new Error("Comment deletion returned an invalid result");
  }

  async setLike(viewerId: string, commentId: string, liked: boolean) {
    const result = await this.repository.setReaction(commentId, viewerId, liked ? ReactionType.LIKE : null);
    if (result === null) throw notFound("Comment");
    return { liked: result.viewerReaction !== null, likeCount: result.reactionCount };
  }

  async setReaction(viewerId: string, commentId: string, input: CommentReactionBodyRequest | null) {
    const result = await this.repository.setReaction(commentId, viewerId, input === null ? null : toReactionType(input.reaction));
    if (result === null) throw notFound("Comment");
    return {
      reactionCount: result.reactionCount,
      viewerReaction: result.viewerReaction === null ? null : reactionValue(result.viewerReaction),
      reactionBreakdown: reactionBreakdownDto(result.reactionBreakdown),
    };
  }

  async likers(viewerId: string, commentId: string, query: PageQuery) {
    const limit = normalizePageLimit(query.limit); const rows = await this.repository.listLikers(commentId, viewerId, this.decode(query.cursor), limit + 1);
    if (rows === null) throw notFound("Comment");
    const page = takePage(rows, limit);
    return {
      items: page.items.map(({ user, createdAt }) => ({ ...user, likedAt: createdAt.toISOString() })),
      nextCursor: page.hasMore ? this.likerCursor(page.items.at(-1)) : null,
    };
  }

  async reactors(viewerId: string, commentId: string, query: PageQuery) {
    const limit = normalizePageLimit(query.limit); const rows = await this.repository.listReactors(commentId, viewerId, this.decode(query.cursor), limit + 1);
    if (rows === null) throw notFound("Comment");
    const page = takePage(rows, limit);
    return {
      items: page.items.map(({ user, reactionType, updatedAt }) => ({ user, reaction: reactionValue(reactionType), reactedAt: updatedAt.toISOString() })),
      nextCursor: page.hasMore ? this.reactorCursor(page.items.at(-1)) : null,
    };
  }

  private page(rows: CommentRecord[], limit: number) {
    const page = takePage(rows, limit);
    return { items: page.items.map(commentDto), nextCursor: page.hasMore ? this.commentCursor(page.items.at(-1)) : null };
  }
  private decode(value: string | undefined): TimelineCursor | undefined { return value === undefined ? undefined : this.cursors.decode(value); }
  private commentCursor(comment: CommentRecord | undefined): string | null { return comment === undefined ? null : this.cursors.encode({ createdAt: comment.createdAt, id: comment.id }); }
  private likerCursor(liker: CommentLikerRecord | undefined): string | null { return liker === undefined ? null : this.cursors.encode({ createdAt: liker.createdAt, id: liker.id }); }
  private reactorCursor(reactor: { id: string; updatedAt: Date } | undefined): string | null { return reactor === undefined ? null : this.cursors.encode({ createdAt: reactor.updatedAt, id: reactor.id }); }
}

function notFound(resource: string): AppError { return new AppError(404, "NOT_FOUND", `${resource} was not found`); }
function forbidden(): AppError { return new AppError(403, "FORBIDDEN", "You do not have permission to modify this comment"); }
function nestedReplyError(): AppError { return new AppError(400, "BAD_REQUEST", "Replies can only be added to root comments"); }
