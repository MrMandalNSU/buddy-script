import "dotenv/config";
import pino from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoCommentReactions, demoComments, demoIds, demoPostReactions, demoPosts, demoSummary, demoUsers } from "../../prisma/seed-data.js";
import { ReactionType } from "../../src/generated/prisma/client.js";
import { createDatabaseClient, type DatabaseClient } from "../../src/infrastructure/database/client.js";
import { verifyPassword } from "../../src/modules/auth/password.service.js";

const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_DEV;
const databaseSuite = process.env.RUN_DATABASE_TESTS === "true" && databaseUrl !== undefined ? describe : describe.skip;
const integrationDatabaseUrl = databaseUrl ?? "postgresql://integration-tests-disabled.invalid/buddy";

databaseSuite("demo seed", { concurrent: false }, () => {
  let database: DatabaseClient;

  beforeAll(async () => {
    database = createDatabaseClient(integrationDatabaseUrl, pino({ level: "silent" }));
    await database.$connect();
  });
  afterAll(async () => database.$disconnect());

  it("contains every stable fixture and valid demo credentials", async () => {
    const users = await database.user.findMany({ where: { id: { in: demoUsers.map(({ id }) => id) } } });
    const posts = await database.post.findMany({ where: { id: { in: demoPosts.map(({ id }) => id) } } });
    const comments = await database.comment.findMany({ where: { id: { in: demoComments.map(({ id }) => id) } } });
    expect(users).toHaveLength(demoSummary.users);
    expect(posts).toHaveLength(demoSummary.posts);
    expect(comments).toHaveLength(demoSummary.comments + demoSummary.replies);
    const alex = users.find(({ id }) => id === demoIds.users.alex);
    expect(alex).toBeDefined();
    expect(await verifyPassword(alex?.passwordHash ?? "", "Password123!")).toBe(true);
  });

  it("keeps denormalized counters synchronized with actual relationships", async () => {
    const postRows = await database.$queryRaw<{ id: string; storedLikes: number; actualLikes: number; storedComments: number; actualComments: number }[]>`
      SELECT p.id, p.like_count AS "storedLikes", count(DISTINCT pl.id)::integer AS "actualLikes",
        p.comment_count AS "storedComments", count(DISTINCT c.id)::integer AS "actualComments"
      FROM posts p LEFT JOIN post_likes pl ON pl.post_id = p.id
      LEFT JOIN comments c ON c.post_id = p.id AND c.parent_id IS NULL
      WHERE p.id::text LIKE '01900000-0000-7000-8000-0000000001%'
      GROUP BY p.id
    `;
    expect(postRows).toHaveLength(demoSummary.posts);
    for (const row of postRows) {
      expect(row.storedLikes).toBe(row.actualLikes);
      expect(row.storedComments).toBe(row.actualComments);
    }
    const commentRows = await database.$queryRaw<{ id: string; storedReactions: number; actualReactions: number; storedReplies: number; actualReplies: number }[]>`
      SELECT c.id, c.like_count AS "storedReactions", count(DISTINCT cl.id)::integer AS "actualReactions",
        c.reply_count AS "storedReplies", count(DISTINCT r.id)::integer AS "actualReplies"
      FROM comments c LEFT JOIN comment_likes cl ON cl.comment_id = c.id
      LEFT JOIN comments r ON r.parent_id = c.id
      WHERE c.id::text LIKE '01900000-0000-7000-8000-0000000002%'
      GROUP BY c.id
    `;
    expect(commentRows).toHaveLength(demoSummary.comments + demoSummary.replies);
    for (const row of commentRows) {
      expect(row.storedReactions).toBe(row.actualReactions);
      expect(row.storedReplies).toBe(row.actualReplies);
    }
  });

  it("seeds typed reactions from real demo accounts on posts, comments, and replies", async () => {
    const [postReactions, commentReactions] = await Promise.all([
      database.postLike.findMany({
        where: { id: { in: demoPostReactions.map(({ id }) => id) } },
        include: { user: { select: { avatarUrl: true } } },
      }),
      database.commentLike.findMany({
        where: { id: { in: demoCommentReactions.map(({ id }) => id) } },
        include: { user: { select: { avatarUrl: true } }, comment: { select: { parentId: true } } },
      }),
    ]);
    expect(postReactions).toHaveLength(demoSummary.postReactions);
    expect(commentReactions).toHaveLength(demoSummary.commentReactions);
    expect(new Set(postReactions.map(({ reactionType }) => reactionType))).toEqual(new Set(Object.values(ReactionType)));
    expect(new Set(commentReactions.map(({ reactionType }) => reactionType))).toEqual(new Set(Object.values(ReactionType)));
    expect(postReactions.every(({ user }) => user.avatarUrl !== null)).toBe(true);
    expect(commentReactions.every(({ user }) => user.avatarUrl !== null)).toBe(true);
    expect(commentReactions.some(({ comment }) => comment.parentId !== null)).toBe(true);
  });

  it("provides ordered public content and isolated private examples", async () => {
    const publicPosts = await database.post.findMany({
      where: { id: { in: demoPosts.map(({ id }) => id) }, visibility: "PUBLIC" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    expect(publicPosts).toHaveLength(demoSummary.publicPosts);
    expect(publicPosts[0]?.id).toBe(demoIds.posts.welcome);
    const privatePosts = await database.post.findMany({ where: { id: { in: [demoIds.posts.alexPrivate, demoIds.posts.mayaPrivate] }, visibility: "PRIVATE" } });
    expect(privatePosts.map(({ authorId }) => authorId).sort()).toEqual([demoIds.users.alex, demoIds.users.maya].sort());
  });
});
