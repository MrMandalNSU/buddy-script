import "dotenv/config";
import { Router } from "express";
import pino from "pino";
import request, { type Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { loadEnvironment, type Environment } from "../../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../../src/infrastructure/database/client.js";
import { ReadinessState } from "../../src/infrastructure/lifecycle/readiness.js";
import { createAuthRouter } from "../../src/modules/auth/auth.routes.js";
import { createCommentRouter } from "../../src/modules/comments/comment.routes.js";
import { createPostRouter } from "../../src/modules/posts/post.routes.js";

const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_DEV;
const databaseSuite = process.env.RUN_DATABASE_TESTS === "true" && databaseUrl !== undefined ? describe : describe.skip;
const testDatabaseUrl = databaseUrl ?? "postgresql://integration-tests-disabled.invalid/buddy";

databaseSuite("comments API", { concurrent: false }, () => {
  let database: DatabaseClient; let environment: Environment; let application: ReturnType<typeof createApp>;
  const createdPostIds: string[] = [];

  beforeAll(() => {
    environment = loadEnvironment({
      NODE_ENV: "test", DATABASE_URL: testDatabaseUrl, ALLOWED_ORIGINS: "http://localhost:3000",
      JWT_ACCESS_SECRET: "access".repeat(12), JWT_REFRESH_SECRET: "refresh".repeat(12),
      JWT_ISSUER: "buddyscript-test", JWT_AUDIENCE: "buddyscript-test-web", COOKIE_SECURE: "false",
      CURSOR_SIGNING_SECRET: "cursor".repeat(12),
    });
    database = createDatabaseClient(testDatabaseUrl, pino({ level: "silent" }));
    const apiRouter = Router(); apiRouter.use("/auth", createAuthRouter(database, environment));
    apiRouter.use(createCommentRouter(database, environment)); apiRouter.use("/posts", createPostRouter(database, environment));
    const readiness = new ReadinessState(); readiness.markReady();
    application = createApp({ environment, readiness, apiRouter, logger: pino({ level: "silent" }) });
  });

  afterAll(async () => {
    await database.post.deleteMany({ where: { id: { in: createdPostIds } } });
    await database.$disconnect();
  });

  it("paginates engagement, prevents nesting, and inherits post privacy", async () => {
    const alex = request.agent(application); const karim = request.agent(application);
    const alexCsrf = csrfCookie(await login(alex, "alex@buddy.test")); const karimCsrf = csrfCookie(await login(karim, "karim@buddy.test"));
    const publicId = await createPost(alex, alexCsrf, "Phase 5 public post", "public");
    const privateId = await createPost(alex, alexCsrf, "Phase 5 private post", "private");
    createdPostIds.push(publicId, privateId);

    const first = await alex.post(`/api/v1/posts/${publicId}/comments`).set("x-csrf-token", alexCsrf).send({ body: "First root comment" });
    const second = await alex.post(`/api/v1/posts/${publicId}/comments`).set("x-csrf-token", alexCsrf).send({ body: "Second root comment" });
    expect(first.status).toBe(201); expect(second.status).toBe(201);
    const firstId = dataId(first); const secondId = dataId(second);

    const feed = (await alex.get("/api/v1/posts")).body as FeedBody;
    const preview = feed.data.items.find(({ id }) => id === publicId)?.commentPreview[0];
    expect(preview).toMatchObject({
      id: secondId,
      postId: publicId,
      parentId: null,
      depth: 0,
      body: "Second root comment",
      engagement: { likeCount: 0, replyCount: 0, likedByViewer: false },
    });
    expect(preview?.createdAt).toEqual(expect.any(String));
    expect(preview?.updatedAt).toEqual(expect.any(String));

    const pageOne = (await alex.get(`/api/v1/posts/${publicId}/comments?limit=1`)).body as PageBody;
    expect(pageOne.data.items).toHaveLength(1);
    if (pageOne.data.nextCursor === null) throw new Error("Expected comment cursor");
    const pageTwo = (await alex.get(`/api/v1/posts/${publicId}/comments?limit=1&cursor=${encodeURIComponent(pageOne.data.nextCursor)}`)).body as PageBody;
    expect(pageTwo.data.items[0]?.id).not.toBe(pageOne.data.items[0]?.id);

    const reply = await alex.post(`/api/v1/comments/${firstId}/replies`).set("x-csrf-token", alexCsrf).send({ body: "One valid reply" });
    expect(reply.status).toBe(201); const replyId = dataId(reply);
    expect(((await alex.get(`/api/v1/comments/${firstId}/replies`)).body as PageBody).data.items[0]?.id).toBe(replyId);
    expect((await alex.post(`/api/v1/comments/${replyId}/replies`).set("x-csrf-token", alexCsrf).send({ body: "Nested reply" })).status).toBe(400);
    expect((await alex.get(`/api/v1/comments/${replyId}/replies`)).status).toBe(400);

    const concurrentLikes = await Promise.all([
      alex.post(`/api/v1/comments/${firstId}/like`).set("x-csrf-token", alexCsrf),
      alex.post(`/api/v1/comments/${firstId}/like`).set("x-csrf-token", alexCsrf),
    ]);
    expect(concurrentLikes.map(({ status }) => status)).toEqual([200, 200]);
    expect(concurrentLikes.map((response) => (response.body as ReactionBody).data.likeCount)).toEqual([1, 1]);
    expect((await alex.post(`/api/v1/comments/${replyId}/like`).set("x-csrf-token", alexCsrf)).status).toBe(200);

    const likers = (await alex.get(`/api/v1/comments/${firstId}/likers`)).body as LikersBody;
    expect(likers.data.items).toEqual([expect.objectContaining({ firstName: "Alex" })]);
    expect(likers.data.items[0]).not.toHaveProperty("email");
    expect((await alex.delete(`/api/v1/comments/${firstId}/like`).set("x-csrf-token", alexCsrf)).body).toMatchObject({ data: { liked: false, likeCount: 0 } });
    expect((await alex.delete(`/api/v1/comments/${firstId}/like`).set("x-csrf-token", alexCsrf)).body).toMatchObject({ data: { liked: false, likeCount: 0 } });

    const love = await alex.put(`/api/v1/comments/${firstId}/reaction`).set("x-csrf-token", alexCsrf).send({ reaction: "love" });
    expect(love.body).toMatchObject({ data: { reactionCount: 1, viewerReaction: "love", reactionBreakdown: { love: 1 } } });
    const wow = await karim.put(`/api/v1/comments/${firstId}/reaction`).set("x-csrf-token", karimCsrf).send({ reaction: "wow" });
    expect(wow.body).toMatchObject({ data: { reactionCount: 2, viewerReaction: "wow", reactionBreakdown: { love: 1, wow: 1 } } });
    const changed = await alex.put(`/api/v1/comments/${firstId}/reaction`).set("x-csrf-token", alexCsrf).send({ reaction: "sad" });
    expect(changed.body).toMatchObject({ data: { reactionCount: 2, viewerReaction: "sad", reactionBreakdown: { love: 0, sad: 1, wow: 1 } } });
    const reactors = (await alex.get(`/api/v1/comments/${firstId}/reactors`)).body as ReactorsBody;
    expect(reactors.data.items.map(({ reaction }) => reaction)).toEqual(expect.arrayContaining(["sad", "wow"]));
    expect(reactors.data.items[0]?.user).not.toHaveProperty("email");

    const edited = await alex.patch(`/api/v1/comments/${firstId}`).set("x-csrf-token", alexCsrf).send({ body: "First root comment edited" });
    expect(edited.body).toMatchObject({ data: { id: firstId, body: "First root comment edited" } });
    expect((await karim.patch(`/api/v1/comments/${firstId}`).set("x-csrf-token", karimCsrf).send({ body: "Unauthorized edit" })).status).toBe(403);
    expect((await karim.delete(`/api/v1/comments/${firstId}`).set("x-csrf-token", karimCsrf)).status).toBe(403);

    const removableReply = await karim.post(`/api/v1/comments/${firstId}/replies`).set("x-csrf-token", karimCsrf).send({ body: "Temporary reply" });
    const removableReplyId = dataId(removableReply);
    expect((await karim.delete(`/api/v1/comments/${removableReplyId}`).set("x-csrf-token", karimCsrf)).status).toBe(204);
    expect(await database.comment.findUnique({ where: { id: removableReplyId } })).toBeNull();

    const removableRoot = await karim.post(`/api/v1/posts/${publicId}/comments`).set("x-csrf-token", karimCsrf).send({ body: "Post owner may delete this thread" });
    const removableRootId = dataId(removableRoot);
    const cascadingReply = await karim.post(`/api/v1/comments/${removableRootId}/replies`).set("x-csrf-token", karimCsrf).send({ body: "Cascading reply" });
    const cascadingReplyId = dataId(cascadingReply);
    expect((await alex.patch(`/api/v1/comments/${removableRootId}`).set("x-csrf-token", alexCsrf).send({ body: "Post owner cannot edit" })).status).toBe(403);
    expect((await alex.delete(`/api/v1/comments/${removableRootId}`).set("x-csrf-token", alexCsrf)).status).toBe(204);
    expect(await database.comment.findMany({ where: { id: { in: [removableRootId, cascadingReplyId] } } })).toHaveLength(0);

    const privateComment = await alex.post(`/api/v1/posts/${privateId}/comments`).set("x-csrf-token", alexCsrf).send({ body: "Private comment" });
    const privateCommentId = dataId(privateComment);
    expect((await karim.get(`/api/v1/posts/${privateId}/comments`)).status).toBe(404);
    expect((await karim.post(`/api/v1/posts/${privateId}/comments`).set("x-csrf-token", karimCsrf).send({ body: "Probe" })).status).toBe(404);
    expect((await karim.post(`/api/v1/comments/${privateCommentId}/like`).set("x-csrf-token", karimCsrf)).status).toBe(404);
    expect((await karim.get(`/api/v1/comments/${privateCommentId}/likers`)).status).toBe(404);

    const [post, root] = await Promise.all([
      database.post.findUniqueOrThrow({ where: { id: publicId }, select: { commentCount: true } }),
      database.comment.findUniqueOrThrow({ where: { id: firstId }, select: { replyCount: true } }),
    ]);
    expect(post.commentCount).toBe(2); expect(root.replyCount).toBe(1);
    expect(secondId).not.toBe(firstId);
  }, 30_000);
});

async function login(agent: ReturnType<typeof request.agent>, email: string): Promise<Response> {
  const response = await agent.post("/api/v1/auth/login").send({ email, password: "Password123!" }); expect(response.status).toBe(200); return response;
}
async function createPost(agent: ReturnType<typeof request.agent>, csrf: string, body: string, visibility: "public" | "private"): Promise<string> {
  const response = await agent.post("/api/v1/posts").set("x-csrf-token", csrf).send({ body, visibility }); expect(response.status).toBe(201); return dataId(response);
}
function csrfCookie(response: Response): string {
  const values: unknown = response.headers["set-cookie"];
  if (!Array.isArray(values)) throw new Error("Expected cookies");
  const cookie = values.find((value: unknown): value is string => typeof value === "string" && value.startsWith("bs_csrf="));
  if (cookie === undefined) throw new Error("Expected CSRF cookie");
  return decodeURIComponent(cookie.slice("bs_csrf=".length).split(";", 1)[0] ?? "");
}
function dataId(response: Response): string { return (response.body as { data: { id: string } }).data.id; }
interface PageBody { data: { items: { id: string }[]; nextCursor: string | null } }
interface FeedBody { data: { items: { id: string; commentPreview: { id: string; postId: string; parentId: string | null; depth: number; body: string; engagement: { likeCount: number; replyCount: number; likedByViewer: boolean }; createdAt: string; updatedAt: string }[] }[] } }
interface ReactionBody { data: { liked: boolean; likeCount: number } }
interface LikersBody { data: { items: { firstName: string; lastName: string }[]; nextCursor: string | null } }
interface ReactorsBody { data: { items: { user: { firstName: string; lastName: string }; reaction: string; reactedAt: string }[]; nextCursor: string | null } }
