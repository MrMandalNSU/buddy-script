import { v7 as uuidv7 } from "uuid";
import { Prisma, type ReactionType } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/client.js";
import { withTransaction } from "../../infrastructure/database/transaction.js";
import type { TimelineCursor } from "../../shared/pagination/cursor.service.js";
import { emptyReactionBreakdown } from "../posts/post.types.js";
import type {
  CommentLikerRecord,
  CommentMutationResult,
  CommentReactionState,
  CommentReactorRecord,
  CommentRecord,
} from "./comment.types.js";

const authorSelect = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;
const visiblePost = (viewerId: string) => ({ OR: [{ visibility: "PUBLIC" as const }, { authorId: viewerId }] });
const commentSelect = (viewerId: string) => ({
  id: true, postId: true, parentId: true, depth: true, body: true, likeCount: true, replyCount: true, createdAt: true, updatedAt: true,
  author: { select: authorSelect }, likes: { where: { userId: viewerId }, select: { reactionType: true }, take: 1 },
}) satisfies Prisma.CommentSelect;
type CommentRow = Prisma.CommentGetPayload<{ select: ReturnType<typeof commentSelect> }>;

export class CommentRepository {
  constructor(readonly database: DatabaseClient) {}

  async listRoots(postId: string, viewerId: string, cursor: TimelineCursor | undefined, take: number): Promise<CommentRecord[] | null> {
    if (await this.findVisiblePost(postId, viewerId) === null) return null;
    return this.list({ postId, parentId: null }, viewerId, cursor, take);
  }

  async listReplies(commentId: string, viewerId: string, cursor: TimelineCursor | undefined, take: number): Promise<{ parentDepth: number; rows: CommentRecord[] } | null> {
    const parent = await this.findVisibleComment(commentId, viewerId);
    if (parent === null) return null;
    return { parentDepth: parent.depth, rows: await this.list({ parentId: commentId }, viewerId, cursor, take) };
  }

  createRoot(postId: string, authorId: string, body: string): Promise<CommentRecord | null> {
    return withTransaction(this.database, async (transaction) => {
      const post = await transaction.post.findFirst({ where: { id: postId, ...visiblePost(authorId) }, select: { id: true } });
      if (post === null) return null;
      const comment = await transaction.comment.create({ data: { id: uuidv7(), postId, authorId, body, depth: 0 } });
      await transaction.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });
      const author = await transaction.user.findUniqueOrThrow({ where: { id: authorId }, select: authorSelect });
      return { ...comment, viewerReaction: null, reactionBreakdown: emptyReactionBreakdown(), author };
    });
  }

  createReply(commentId: string, authorId: string, body: string): Promise<{ parentDepth: number; reply?: CommentRecord } | null> {
    return withTransaction(this.database, async (transaction) => {
      const parent = await transaction.comment.findFirst({
        where: { id: commentId, post: visiblePost(authorId) }, select: { id: true, postId: true, depth: true },
      });
      if (parent === null) return null;
      if (parent.depth !== 0) return { parentDepth: parent.depth };
      const reply = await transaction.comment.create({ data: { id: uuidv7(), postId: parent.postId, parentId: parent.id, authorId, body, depth: 1 } });
      await transaction.comment.update({ where: { id: parent.id }, data: { replyCount: { increment: 1 } } });
      const author = await transaction.user.findUniqueOrThrow({ where: { id: authorId }, select: authorSelect });
      return { parentDepth: parent.depth, reply: { ...reply, viewerReaction: null, reactionBreakdown: emptyReactionBreakdown(), author } };
    });
  }

  async update(commentId: string, viewerId: string, body: string): Promise<CommentMutationResult> {
    const target = await this.database.comment.findFirst({
      where: { id: commentId, post: visiblePost(viewerId) }, select: { authorId: true },
    });
    if (target === null) return { status: "not-found" };
    if (target.authorId !== viewerId) return { status: "forbidden" };
    await this.database.comment.update({ where: { id: commentId }, data: { body } });
    const row = await this.database.comment.findUniqueOrThrow({ where: { id: commentId }, select: commentSelect(viewerId) });
    const comment = (await this.hydrate([row]))[0];
    if (comment === undefined) throw new Error("Updated comment could not be hydrated");
    return { status: "updated", comment };
  }

  delete(commentId: string, viewerId: string): Promise<CommentMutationResult> {
    return withTransaction(this.database, async (transaction) => {
      const target = await transaction.comment.findFirst({
        where: { id: commentId, post: visiblePost(viewerId) },
        select: { id: true, postId: true, parentId: true, depth: true, authorId: true, post: { select: { authorId: true } } },
      });
      if (target === null) return { status: "not-found" };
      if (target.authorId !== viewerId && target.post.authorId !== viewerId) return { status: "forbidden" };
      await transaction.comment.delete({ where: { id: commentId } });
      if (target.depth === 0) {
        await transaction.post.updateMany({ where: { id: target.postId, commentCount: { gt: 0 } }, data: { commentCount: { decrement: 1 } } });
      } else if (target.parentId !== null) {
        await transaction.comment.updateMany({ where: { id: target.parentId, replyCount: { gt: 0 } }, data: { replyCount: { decrement: 1 } } });
      }
      return { status: "deleted" };
    });
  }

  setReaction(commentId: string, viewerId: string, reactionType: ReactionType | null): Promise<CommentReactionState | null> {
    return withTransaction(this.database, async (transaction) => {
      const comment = await transaction.comment.findFirst({ where: { id: commentId, post: visiblePost(viewerId) }, select: { id: true } });
      if (comment === null) return null;
      if (reactionType !== null) {
        const inserted = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
          INSERT INTO "comment_likes" ("id", "comment_id", "user_id", "reaction_type", "created_at", "updated_at")
          VALUES (${uuidv7()}::uuid, ${commentId}::uuid, ${viewerId}::uuid, ${reactionType}::"reaction_type", NOW(), NOW())
          ON CONFLICT ("comment_id", "user_id") DO NOTHING RETURNING "id"
        `);
        if (inserted.length > 0) {
          await transaction.comment.update({ where: { id: commentId }, data: { likeCount: { increment: 1 } } });
        } else {
          await transaction.commentLike.update({ where: { commentId_userId: { commentId, userId: viewerId } }, data: { reactionType } });
        }
      } else {
        const deleted = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
          DELETE FROM "comment_likes" WHERE "comment_id" = ${commentId}::uuid AND "user_id" = ${viewerId}::uuid RETURNING "id"
        `);
        if (deleted.length > 0) await transaction.comment.updateMany({ where: { id: commentId, likeCount: { gt: 0 } }, data: { likeCount: { decrement: 1 } } });
      }
      const [current, viewer, grouped] = await Promise.all([
        transaction.comment.findUniqueOrThrow({ where: { id: commentId }, select: { likeCount: true } }),
        transaction.commentLike.findUnique({ where: { commentId_userId: { commentId, userId: viewerId } }, select: { reactionType: true } }),
        transaction.commentLike.groupBy({ by: ["reactionType"], where: { commentId }, _count: { _all: true } }),
      ]);
      const reactionBreakdown = emptyReactionBreakdown();
      for (const row of grouped) reactionBreakdown[row.reactionType] = row._count._all;
      return { reactionCount: current.likeCount, viewerReaction: viewer?.reactionType ?? null, reactionBreakdown };
    });
  }

  async listReactors(commentId: string, viewerId: string, cursor: TimelineCursor | undefined, take: number): Promise<CommentReactorRecord[] | null> {
    if (await this.findVisibleComment(commentId, viewerId) === null) return null;
    return this.database.commentLike.findMany({
      where: {
        commentId,
        ...(cursor === undefined ? {} : { OR: [{ updatedAt: { lt: cursor.createdAt } }, { updatedAt: cursor.createdAt, id: { lt: cursor.id } }] }),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take,
      select: { id: true, updatedAt: true, reactionType: true, user: { select: authorSelect } },
    });
  }

  async listLikers(commentId: string, viewerId: string, cursor: TimelineCursor | undefined, take: number): Promise<CommentLikerRecord[] | null> {
    if (await this.findVisibleComment(commentId, viewerId) === null) return null;
    return this.database.commentLike.findMany({
      where: {
        commentId,
        ...(cursor === undefined ? {} : { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take,
      select: { id: true, createdAt: true, user: { select: authorSelect } },
    });
  }

  private findVisiblePost(postId: string, viewerId: string) {
    return this.database.post.findFirst({ where: { id: postId, ...visiblePost(viewerId) }, select: { id: true } });
  }

  private findVisibleComment(commentId: string, viewerId: string) {
    return this.database.comment.findFirst({ where: { id: commentId, post: visiblePost(viewerId) }, select: { id: true, depth: true } });
  }

  private async list(where: { postId?: string; parentId: string | null }, viewerId: string, cursor: TimelineCursor | undefined, take: number): Promise<CommentRecord[]> {
    const rows = await this.database.comment.findMany({
      where: {
        ...where,
        ...(cursor === undefined ? {} : { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, select: commentSelect(viewerId),
    });
    return this.hydrate(rows);
  }

  private async hydrate(rows: CommentRow[]): Promise<CommentRecord[]> {
    if (rows.length === 0) return [];
    const ids = rows.map(({ id }) => id);
    const groups = await this.database.commentLike.groupBy({
      by: ["commentId", "reactionType"], where: { commentId: { in: ids } }, _count: { _all: true },
    });
    const breakdowns = new Map(ids.map((id) => [id, emptyReactionBreakdown()]));
    for (const row of groups) {
      const breakdown = breakdowns.get(row.commentId);
      if (breakdown !== undefined) breakdown[row.reactionType] = row._count._all;
    }
    return rows.map(({ likes, ...comment }) => ({
      ...comment,
      viewerReaction: likes[0]?.reactionType ?? null,
      reactionBreakdown: breakdowns.get(comment.id) ?? emptyReactionBreakdown(),
    }));
  }
}
