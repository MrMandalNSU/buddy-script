import { v7 as uuidv7 } from "uuid";
import { Prisma, type PostVisibility, type ReactionType } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/client.js";
import { withTransaction } from "../../infrastructure/database/transaction.js";
import type { TimelineCursor } from "../../shared/pagination/cursor.service.js";
import {
  emptyReactionBreakdown,
  type CreatePostInput,
  type LikerRecord,
  type PostRecord,
  type ReactionBreakdown,
  type ReactionState,
  type ReactorRecord,
} from "./post.types.js";

const authorSelect = { id: true, firstName: true, lastName: true, avatarUrl: true } as const;
const postSelect = (viewerId: string) => ({
  id: true, body: true, visibility: true, createdAt: true, updatedAt: true,
  imagePublicId: true, imageSecureUrl: true, imageVersion: true, imageWidth: true, imageHeight: true, imageBytes: true, imageFormat: true,
  likeCount: true, commentCount: true, author: { select: authorSelect },
  likes: {
    orderBy: [{ updatedAt: "desc" as const }, { id: "desc" as const }], take: 5,
    select: { reactionType: true, updatedAt: true, user: { select: authorSelect } },
  },
  comments: {
    where: { parentId: null }, orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }], take: 2,
    select: {
      id: true, postId: true, parentId: true, depth: true, body: true, createdAt: true, updatedAt: true,
      likeCount: true, replyCount: true, author: { select: authorSelect },
      likes: { where: { userId: viewerId }, select: { reactionType: true }, take: 1 },
    },
  },
}) satisfies Prisma.PostSelect;
type PostRow = Prisma.PostGetPayload<{ select: ReturnType<typeof postSelect> }>;

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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, select: postSelect(viewerId),
    });
    return this.hydrate(rows, viewerId);
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
    const rows = await this.database.post.findMany({
      where: { id: postId, OR: [{ visibility: "PUBLIC" }, { authorId: viewerId }] },
      take: 1,
      select: postSelect(viewerId),
    });
    return (await this.hydrate(rows, viewerId))[0] ?? null;
  }

  setReaction(postId: string, viewerId: string, reactionType: ReactionType | null): Promise<ReactionState | null> {
    return withTransaction(this.database, async (transaction) => {
      const post = await transaction.post.findFirst({ where: { id: postId, OR: [{ visibility: "PUBLIC" }, { authorId: viewerId }] }, select: { id: true } });
      if (post === null) return null;
      if (reactionType !== null) {
        const inserted = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
          INSERT INTO "post_likes" ("id", "post_id", "user_id", "reaction_type", "created_at", "updated_at")
          VALUES (${uuidv7()}::uuid, ${postId}::uuid, ${viewerId}::uuid, ${reactionType}::"reaction_type", NOW(), NOW())
          ON CONFLICT ("post_id", "user_id") DO NOTHING RETURNING "id"
        `);
        if (inserted.length > 0) {
          await transaction.post.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } });
        } else {
          await transaction.postLike.update({ where: { postId_userId: { postId, userId: viewerId } }, data: { reactionType } });
        }
      } else {
        const deleted = await transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
          DELETE FROM "post_likes" WHERE "post_id" = ${postId}::uuid AND "user_id" = ${viewerId}::uuid RETURNING "id"
        `);
        if (deleted.length > 0) await transaction.post.updateMany({ where: { id: postId, likeCount: { gt: 0 } }, data: { likeCount: { decrement: 1 } } });
      }
      const [current, viewer, grouped, preview] = await Promise.all([
        transaction.post.findUniqueOrThrow({ where: { id: postId }, select: { likeCount: true } }),
        transaction.postLike.findUnique({ where: { postId_userId: { postId, userId: viewerId } }, select: { reactionType: true } }),
        transaction.postLike.groupBy({ by: ["reactionType"], where: { postId }, _count: { _all: true } }),
        transaction.postLike.findMany({
          where: { postId }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 5,
          select: { reactionType: true, updatedAt: true, user: { select: authorSelect } },
        }),
      ]);
      const reactionBreakdown = emptyReactionBreakdown();
      for (const row of grouped) reactionBreakdown[row.reactionType] = row._count._all;
      return { reactionCount: current.likeCount, viewerReaction: viewer?.reactionType ?? null, reactionBreakdown, reactionPreview: preview };
    });
  }

  async listReactors(postId: string, viewerId: string, cursor: TimelineCursor | undefined, take: number): Promise<ReactorRecord[] | null> {
    const visible = await this.database.post.findFirst({ where: { id: postId, OR: [{ visibility: "PUBLIC" }, { authorId: viewerId }] }, select: { id: true } });
    if (visible === null) return null;
    return this.database.postLike.findMany({
      where: {
        postId,
        ...(cursor === undefined ? {} : { OR: [{ updatedAt: { lt: cursor.createdAt } }, { updatedAt: cursor.createdAt, id: { lt: cursor.id } }] }),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take,
      select: { id: true, updatedAt: true, reactionType: true, user: { select: authorSelect } },
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

  private async hydrate(rows: PostRow[], viewerId: string): Promise<PostRecord[]> {
    if (rows.length === 0) return [];
    const postIds = rows.map(({ id }) => id);
    const commentIds = rows.flatMap(({ comments }) => comments.map(({ id }) => id));
    const [viewerRows, postGroups, commentGroups] = await Promise.all([
      this.database.postLike.findMany({ where: { userId: viewerId, postId: { in: postIds } }, select: { postId: true, reactionType: true } }),
      this.database.postLike.groupBy({ by: ["postId", "reactionType"], where: { postId: { in: postIds } }, _count: { _all: true } }),
      this.database.commentLike.groupBy({ by: ["commentId", "reactionType"], where: { commentId: { in: commentIds } }, _count: { _all: true } }),
    ]);
    const viewerByPost = new Map(viewerRows.map((row) => [row.postId, row.reactionType]));
    const postBreakdowns = breakdowns(postIds, postGroups.map((row) => ({ id: row.postId, reactionType: row.reactionType, count: row._count._all })));
    const commentBreakdowns = breakdowns(commentIds, commentGroups.map((row) => ({ id: row.commentId, reactionType: row.reactionType, count: row._count._all })));
    return rows.map((row) => ({
      id: row.id, body: row.body, visibility: row.visibility, createdAt: row.createdAt, updatedAt: row.updatedAt,
      image: imageFrom(row), likeCount: row.likeCount, commentCount: row.commentCount,
      viewerReaction: viewerByPost.get(row.id) ?? null,
      reactionBreakdown: postBreakdowns.get(row.id) ?? emptyReactionBreakdown(),
      reactionPreview: row.likes,
      author: row.author,
      commentPreview: row.comments.map(({ likes, ...comment }) => ({
        ...comment,
        viewerReaction: likes[0]?.reactionType ?? null,
        reactionBreakdown: commentBreakdowns.get(comment.id) ?? emptyReactionBreakdown(),
      })),
    }));
  }
}

function breakdowns(ids: string[], rows: { id: string; reactionType: ReactionType; count: number }[]): Map<string, ReactionBreakdown> {
  const result = new Map(ids.map((id) => [id, emptyReactionBreakdown()]));
  for (const row of rows) {
    const breakdown = result.get(row.id);
    if (breakdown !== undefined) breakdown[row.reactionType] = row.count;
  }
  return result;
}

interface ImageColumns { imagePublicId: string | null; imageSecureUrl: string | null; imageVersion: number | null; imageWidth: number | null; imageHeight: number | null; imageBytes: number | null; imageFormat: string | null }
function imageFrom(row: ImageColumns): PostRecord["image"] {
  if (row.imagePublicId === null || row.imageSecureUrl === null || row.imageVersion === null || row.imageWidth === null || row.imageHeight === null || row.imageBytes === null || row.imageFormat === null) return null;
  return { publicId: row.imagePublicId, secureUrl: row.imageSecureUrl, version: row.imageVersion, width: row.imageWidth, height: row.imageHeight, bytes: row.imageBytes, format: row.imageFormat };
}

export function toPostVisibility(value: "public" | "private"): PostVisibility { return value === "public" ? "PUBLIC" : "PRIVATE"; }
