import { v7 as uuidv7 } from "uuid";
import { Prisma } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/client.js";
import { withTransaction } from "../../infrastructure/database/transaction.js";
import type { TimelineCursor } from "../../shared/pagination/cursor.service.js";
import type { CommentLikerRecord, CommentReactionState, CommentRecord } from "./comment.types.js";

const authorSelect = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;
const visiblePost = (viewerId: string) => ({ OR: [{ visibility: "PUBLIC" as const }, { authorId: viewerId }] });

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
      return { ...comment, likedByViewer: false, author };
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
      return { parentDepth: parent.depth, reply: { ...reply, likedByViewer: false, author } };
    });
  }

  setLike(commentId: string, viewerId: string, liked: boolean): Promise<CommentReactionState | null> {
    return withTransaction(this.database, async (transaction) => {
      const comment = await transaction.comment.findFirst({ where: { id: commentId, post: visiblePost(viewerId) }, select: { id: true } });
      if (comment === null) return null;
      if (liked) {
        const inserted = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
          INSERT INTO "comment_likes" ("id", "comment_id", "user_id", "created_at")
          VALUES (${uuidv7()}::uuid, ${commentId}::uuid, ${viewerId}::uuid, NOW())
          ON CONFLICT ("comment_id", "user_id") DO NOTHING RETURNING "id"
        `);
        if (inserted.length > 0) await transaction.comment.update({ where: { id: commentId }, data: { likeCount: { increment: 1 } } });
      } else {
        const deleted = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
          DELETE FROM "comment_likes" WHERE "comment_id" = ${commentId}::uuid AND "user_id" = ${viewerId}::uuid RETURNING "id"
        `);
        if (deleted.length > 0) await transaction.comment.updateMany({ where: { id: commentId, likeCount: { gt: 0 } }, data: { likeCount: { decrement: 1 } } });
      }
      const [current, reaction] = await Promise.all([
        transaction.comment.findUniqueOrThrow({ where: { id: commentId }, select: { likeCount: true } }),
        transaction.commentLike.findUnique({ where: { commentId_userId: { commentId, userId: viewerId } }, select: { id: true } }),
      ]);
      return { liked: reaction !== null, likeCount: current.likeCount };
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take,
      select: {
        id: true, postId: true, parentId: true, depth: true, body: true, likeCount: true, replyCount: true, createdAt: true, updatedAt: true,
        author: { select: authorSelect }, likes: { where: { userId: viewerId }, select: { id: true }, take: 1 },
      },
    });
    return rows.map(({ likes, ...comment }) => ({ ...comment, likedByViewer: likes.length > 0 }));
  }
}
