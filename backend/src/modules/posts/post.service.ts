import { normalizePageLimit, takePage } from "../../infrastructure/database/pagination.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { CursorService, TimelineCursor } from "../../shared/pagination/cursor.service.js";
import type { CreatePostRequest, PageQuery, ReactionBodyRequest } from "./post.schemas.js";
import { toPostVisibility, type PostRepository } from "./post.repository.js";
import type { LikerRecord, PostRecord } from "./post.types.js";
import type { CachePort } from "../../infrastructure/cache/cache.port.js";
import { PostVisibility, ReactionType } from "../../generated/prisma/client.js";
import type { CloudinaryService } from "../uploads/cloudinary.service.js";
import { commentDto } from "../comments/comment.dto.js";
import { reactionBreakdownDto, reactionPreviewDto, reactionValue, toReactionType } from "./reaction.dto.js";

export class PostService {
  constructor(
    readonly repository: PostRepository,
    readonly cursors: CursorService,
    readonly cloudinary?: CloudinaryService,
    readonly cache?: CachePort,
    readonly publicFeedTtlSeconds = 5,
  ) {}

  async list(viewerId: string, query: PageQuery) {
    const limit = normalizePageLimit(query.limit); const cursor = this.decode(query.cursor);
    const publicHeadIds = cursor === undefined && this.cache !== undefined
      ? await this.cache.wrap(`feed:public-head:v1:${limit + 1}`, this.publicFeedTtlSeconds, () => this.repository.listPublicHeadIds(limit + 1))
      : undefined;
    const page = takePage(await this.repository.listVisible(viewerId, cursor, limit + 1, publicHeadIds), limit);
    return { items: page.items.map(postDto), nextCursor: page.hasMore ? this.cursorFor(page.items.at(-1)) : null };
  }

  async create(viewerId: string, input: CreatePostRequest) {
    const image = input.image === undefined ? undefined : this.verifyImage(viewerId, input.image);
    const created = await this.repository.create(viewerId, {
      visibility: toPostVisibility(input.visibility),
      ...(input.body === undefined ? {} : { body: input.body.trim() }),
      ...(image === undefined ? {} : { image }),
    });
    if (created.visibility === PostVisibility.PUBLIC) this.cache?.deleteByPrefix("feed:public-head:");
    return postDto(created);
  }

  async setLike(viewerId: string, postId: string, liked: boolean) {
    const result = await this.repository.setReaction(postId, viewerId, liked ? ReactionType.LIKE : null);
    if (result === null) throw notFound();
    return { liked: result.viewerReaction !== null, likeCount: result.reactionCount };
  }

  async setReaction(viewerId: string, postId: string, input: ReactionBodyRequest | null) {
    const result = await this.repository.setReaction(postId, viewerId, input === null ? null : toReactionType(input.reaction));
    if (result === null) throw notFound();
    return reactionStateDto(result);
  }

  async likers(viewerId: string, postId: string, query: PageQuery) {
    const limit = normalizePageLimit(query.limit); const cursor = this.decode(query.cursor);
    const rows = await this.repository.listLikers(postId, viewerId, cursor, limit + 1);
    if (rows === null) throw notFound();
    const page = takePage(rows, limit);
    return {
      items: page.items.map(({ user, createdAt }) => ({ ...user, likedAt: createdAt.toISOString() })),
      nextCursor: page.hasMore ? this.likerCursor(page.items.at(-1)) : null,
    };
  }

  async reactors(viewerId: string, postId: string, query: PageQuery) {
    const limit = normalizePageLimit(query.limit); const cursor = this.decode(query.cursor);
    const rows = await this.repository.listReactors(postId, viewerId, cursor, limit + 1);
    if (rows === null) throw notFound();
    const page = takePage(rows, limit);
    return {
      items: page.items.map(({ user, reactionType, updatedAt }) => ({ user, reaction: reactionValue(reactionType), reactedAt: updatedAt.toISOString() })),
      nextCursor: page.hasMore ? this.reactorCursor(page.items.at(-1)) : null,
    };
  }

  private decode(value: string | undefined): TimelineCursor | undefined { return value === undefined ? undefined : this.cursors.decode(value); }
  private cursorFor(post: PostRecord | undefined): string | null { return post === undefined ? null : this.cursors.encode({ createdAt: post.createdAt, id: post.id }); }
  private likerCursor(liker: LikerRecord | undefined): string | null { return liker === undefined ? null : this.cursors.encode({ createdAt: liker.createdAt, id: liker.id }); }
  private reactorCursor(reactor: { id: string; updatedAt: Date } | undefined): string | null { return reactor === undefined ? null : this.cursors.encode({ createdAt: reactor.updatedAt, id: reactor.id }); }
  private verifyImage(viewerId: string, image: NonNullable<CreatePostRequest["image"]>) {
    if (this.cloudinary === undefined) throw new AppError(503, "INTERNAL_ERROR", "Image uploads are not configured");
    return this.cloudinary.verify(viewerId, image);
  }
}

function postDto(post: PostRecord) {
  return {
    id: post.id, body: post.body, visibility: post.visibility.toLowerCase(), image: post.image,
    createdAt: post.createdAt.toISOString(), updatedAt: post.updatedAt.toISOString(), author: post.author,
    engagement: {
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      likedByViewer: post.viewerReaction !== null,
      reactionCount: post.likeCount,
      viewerReaction: post.viewerReaction === null ? null : reactionValue(post.viewerReaction),
      reactionBreakdown: reactionBreakdownDto(post.reactionBreakdown),
    },
    reactionPreview: reactionPreviewDto(post.reactionPreview),
    commentPreview: post.commentPreview.map(commentDto),
  };
}
function reactionStateDto(state: { reactionCount: number; viewerReaction: ReactionType | null; reactionBreakdown: PostRecord["reactionBreakdown"]; reactionPreview: PostRecord["reactionPreview"] }) {
  return {
    reactionCount: state.reactionCount,
    viewerReaction: state.viewerReaction === null ? null : reactionValue(state.viewerReaction),
    reactionBreakdown: reactionBreakdownDto(state.reactionBreakdown),
    reactionPreview: reactionPreviewDto(state.reactionPreview),
  };
}
function notFound(): AppError { return new AppError(404, "NOT_FOUND", "Post was not found"); }
