import { v7 as uuidv7 } from "uuid";
import { Prisma, type PostVisibility } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/client.js";
import { withTransaction } from "../../infrastructure/database/transaction.js";
import type { TimelineCursor } from "../../shared/pagination/cursor.service.js";
import type { CreatePostInput, LikerRecord, PostRecord, ReactionState } from "./post.types.js";

const authorSelect = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;

export class PostRepository {
  constructor(readonly database: DatabaseClient) {}

  async listVisible(viewerId: string, cursor: TimelineCursor | undefined, take: number, publicHeadIds?: string[]): Promise<PostRecord[]> {
    const rows = await this.database.post.findMany({
      where: {
        AND: [
          publicHeadIds === undefined
            ? { OR: [{ visibility: "PUBLIC" }, { authorId: viewerId }] }
            : { OR: [{ id: { in: publicHeadIds } }, { visibility: "PRIVATE", authorId: viewerId }] },
          ...(cursor === undefined ? [] : [{ OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }]),
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take,
      select: {
        id: true, body: true, visibility: true, createdAt: true, updatedAt: true,
        imagePublicId: true, imageSecureUrl: true, imageVersion: true, imageWidth: true, imageHeight: true, imageBytes: true, imageFormat: true,
        likeCount: true, commentCount: true, author: { select: authorSelect },
        likes: { where: { userId: viewerId }, select: { id: true }, take: 1 },
        comments: {
          where: { parentId: null }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 2,
          select: { id: true, body: true, createdAt: true, likeCount: true, replyCount: true, author: { select: authorSelect }, likes: { where: { userId: viewerId }, select: { id: true }, take: 1 } },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id, body: row.body, visibility: row.visibility, createdAt: row.createdAt, updatedAt: row.updatedAt,
      image: imageFrom(row), likeCount: row.likeCount, commentCount: row.commentCount, likedByViewer: row.likes.length > 0,
      author: row.author,
      commentPreview: row.comments.map(({ likes, ...comment }) => ({ ...comment, likedByViewer: likes.length > 0 })),
    }));
  }

  async listPublicHeadIds(take: number): Promise<string[]> {
    return (await this.database.post.findMany({ where: { visibility: "PUBLIC" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, select: { id: true } })).map(({ id }) => id);
  }

  async create(authorId: string, input: CreatePostInput): Promise<PostRecord> {
    const created = await this.database.post.create({ data: {
      id: uuidv7(), authorId, visibility: input.visibility,
      ...(input.body === undefined ? {} : { body: input.body }),
      ...(input.image === undefined ? {} : {
        imagePublicId: input.image.publicId, imageSecureUrl: input.image.secureUrl, imageVersion: input.image.version,
        imageWidth: input.image.width, imageHeight: input.image.height, imageBytes: input.image.bytes, imageFormat: input.image.format,
      }),
    } });
    const post = await this.findVisibleById(created.id, authorId);
    if (post === null) throw new Error("Created post could not be loaded");
    return post;
  }

  async findVisibleById(postId: string, viewerId: string): Promise<PostRecord | null> {
    const rows = await this.listById(postId, viewerId);
    return rows[0] ?? null;
  }

  setLike(postId: string, viewerId: string, liked: boolean): Promise<ReactionState | null> {
    return withTransaction(this.database, async (transaction) => {
      const post = await transaction.post.findFirst({ where: { id: postId, OR: [{ visibility: "PUBLIC" }, { authorId: viewerId }] }, select: { id: true } });
      if (post === null) return null;
      if (liked) {
        const inserted = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
          INSERT INTO "post_likes" ("id", "post_id", "user_id", "created_at")
          VALUES (${uuidv7()}::uuid, ${postId}::uuid, ${viewerId}::uuid, NOW())
          ON CONFLICT ("post_id", "user_id") DO NOTHING RETURNING "id"
        `);
        if (inserted.length > 0) await transaction.post.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } });
      } else {
        const deleted = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
          DELETE FROM "post_likes" WHERE "post_id" = ${postId}::uuid AND "user_id" = ${viewerId}::uuid RETURNING "id"
        `);
        if (deleted.length > 0) await transaction.post.updateMany({ where: { id: postId, likeCount: { gt: 0 } }, data: { likeCount: { decrement: 1 } } });
      }
      const [current, reaction] = await Promise.all([
        transaction.post.findUniqueOrThrow({ where: { id: postId }, select: { likeCount: true } }),
        transaction.postLike.findUnique({ where: { postId_userId: { postId, userId: viewerId } }, select: { id: true } }),
      ]);
      return { liked: reaction !== null, likeCount: current.likeCount };
    });
  }

  async listLikers(postId: string, viewerId: string, cursor: TimelineCursor | undefined, take: number): Promise<LikerRecord[] | null> {
    const visible = await this.database.post.findFirst({ where: { id: postId, OR: [{ visibility: "PUBLIC" }, { authorId: viewerId }] }, select: { id: true } });
    if (visible === null) return null;
    return this.database.postLike.findMany({
      where: {
        postId,
        ...(cursor === undefined ? {} : { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take,
      select: { id: true, createdAt: true, user: { select: authorSelect } },
    });
  }

  private async listById(postId: string, viewerId: string): Promise<PostRecord[]> {
    const rows = await this.database.post.findMany({
      where: { id: postId, OR: [{ visibility: "PUBLIC" }, { authorId: viewerId }] }, take: 1,
      select: {
        id: true, body: true, visibility: true, createdAt: true, updatedAt: true,
        imagePublicId: true, imageSecureUrl: true, imageVersion: true, imageWidth: true, imageHeight: true, imageBytes: true, imageFormat: true,
        likeCount: true, commentCount: true, author: { select: authorSelect }, likes: { where: { userId: viewerId }, select: { id: true }, take: 1 },
        comments: { where: { parentId: null }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 2, select: { id: true, body: true, createdAt: true, likeCount: true, replyCount: true, author: { select: authorSelect }, likes: { where: { userId: viewerId }, select: { id: true }, take: 1 } } },
      },
    });
    return rows.map((row) => ({ id: row.id, body: row.body, visibility: row.visibility, createdAt: row.createdAt, updatedAt: row.updatedAt, image: imageFrom(row), likeCount: row.likeCount, commentCount: row.commentCount, likedByViewer: row.likes.length > 0, author: row.author, commentPreview: row.comments.map(({ likes, ...comment }) => ({ ...comment, likedByViewer: likes.length > 0 })) }));
  }
}

interface ImageColumns { imagePublicId: string | null; imageSecureUrl: string | null; imageVersion: number | null; imageWidth: number | null; imageHeight: number | null; imageBytes: number | null; imageFormat: string | null }
function imageFrom(row: ImageColumns): PostRecord["image"] {
  if (row.imagePublicId === null || row.imageSecureUrl === null || row.imageVersion === null || row.imageWidth === null || row.imageHeight === null || row.imageBytes === null || row.imageFormat === null) return null;
  return { publicId: row.imagePublicId, secureUrl: row.imageSecureUrl, version: row.imageVersion, width: row.imageWidth, height: row.imageHeight, bytes: row.imageBytes, format: row.imageFormat };
}

export function toPostVisibility(value: "public" | "private"): PostVisibility { return value === "public" ? "PUBLIC" : "PRIVATE"; }
