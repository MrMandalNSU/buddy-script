import "dotenv/config";
import pino from "pino";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostVisibility, ReactionType } from "../../src/generated/prisma/client.js";
import { demoSummary } from "../../prisma/seed-data.js";
import { createDatabaseClient, type DatabaseClient } from "../../src/infrastructure/database/client.js";

const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_DEV;
const databaseSuite = process.env.RUN_DATABASE_TESTS === "true" && databaseUrl !== undefined ? describe : describe.skip;
const integrationDatabaseUrl = databaseUrl ?? "postgresql://integration-tests-disabled.invalid/buddy";

databaseSuite("Neon schema integration", { concurrent: false }, () => {
  let database: DatabaseClient;

  beforeAll(async () => {
    database = createDatabaseClient(integrationDatabaseUrl, pino({ level: "silent" }));
    await database.$connect();
  });

  afterAll(async () => database.$disconnect());

  it("contains the deterministic public and private seed posts", async () => {
    const grouped = await database.post.groupBy({ by: ["visibility"], _count: true });
    const publicCount = grouped.find(({ visibility }) => visibility === PostVisibility.PUBLIC)?._count ?? 0;
    const privateCount = grouped.find(({ visibility }) => visibility === PostVisibility.PRIVATE)?._count ?? 0;
    expect(publicCount).toBeGreaterThanOrEqual(demoSummary.publicPosts);
    expect(privateCount).toBeGreaterThanOrEqual(demoSummary.privatePosts);
  });

  it("enforces normalized unique emails at the database boundary", async () => {
    await expect(database.user.create({ data: {
      id: uuidv7(), firstName: "Invalid", lastName: "Email", email: "Mixed@Example.com",
      emailNormalized: "not-normalized@example.com", passwordHash: "not-authenticatable",
    } })).rejects.toThrow();
  });

  it("requires post text or complete image metadata", async () => {
    await expect(database.post.create({ data: {
      id: uuidv7(), authorId: "01900000-0000-7000-8000-000000000001", body: "   ", visibility: PostVisibility.PUBLIC,
    } })).rejects.toThrow();
  });

  it("prevents replies to replies", async () => {
    await expect(database.comment.create({ data: {
      id: uuidv7(), postId: "01900000-0000-7000-8000-000000000101",
      authorId: "01900000-0000-7000-8000-000000000001",
      parentId: "01900000-0000-7000-8000-000000000202", depth: 1, body: "Invalid nested reply",
    } })).rejects.toThrow();
  });

  it("prevents duplicate user-target likes", async () => {
    await expect(database.postLike.create({ data: {
      id: uuidv7(), postId: "01900000-0000-7000-8000-000000000101", userId: "01900000-0000-7000-8000-000000000003",
    } })).rejects.toThrow();
  });

  it("migrates existing likes to typed Like reactions", async () => {
    const [postReaction, commentReaction] = await Promise.all([
      database.postLike.findFirst({ where: { reactionType: ReactionType.LIKE }, orderBy: { createdAt: "asc" }, select: { reactionType: true, createdAt: true, updatedAt: true } }),
      database.commentLike.findFirst({ where: { reactionType: ReactionType.LIKE }, orderBy: { createdAt: "asc" }, select: { reactionType: true, createdAt: true, updatedAt: true } }),
    ]);
    expect(postReaction?.reactionType).toBe(ReactionType.LIKE);
    expect(commentReaction?.reactionType).toBe(ReactionType.LIKE);
    expect(postReaction?.updatedAt).toEqual(postReaction?.createdAt);
    expect(commentReaction?.updatedAt).toEqual(commentReaction?.createdAt);
  });

  it("installs the required partial feed indexes", async () => {
    const indexes = await database.$queryRaw<{ indexname: string }[]>`
      SELECT indexname::text AS indexname FROM pg_indexes
      WHERE schemaname = 'public' AND indexname IN (
        'posts_public_feed_idx', 'posts_private_author_feed_idx',
        'comments_root_feed_idx', 'comments_replies_feed_idx',
        'refresh_sessions_active_family_idx'
      )
    `;
    expect(indexes.map(({ indexname }) => indexname).sort()).toEqual([
      "comments_replies_feed_idx", "comments_root_feed_idx", "posts_private_author_feed_idx",
      "posts_public_feed_idx", "refresh_sessions_active_family_idx",
    ]);
  });
});
