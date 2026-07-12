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
import { createPostRouter } from "../../src/modules/posts/post.routes.js";

const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_DEV;
const databaseSuite = process.env.RUN_DATABASE_TESTS === "true" && databaseUrl !== undefined ? describe : describe.skip;
const testDatabaseUrl = databaseUrl ?? "postgresql://integration-tests-disabled.invalid/buddy";

databaseSuite("posts API", { concurrent: false }, () => {
  let database: DatabaseClient;
  let environment: Environment;
  let application: ReturnType<typeof createApp>;
  const createdPostIds: string[] = [];

  beforeAll(() => {
    environment = loadEnvironment({
      NODE_ENV: "test", DATABASE_URL: testDatabaseUrl, ALLOWED_ORIGINS: "http://localhost:3000",
      JWT_ACCESS_SECRET: "access".repeat(12), JWT_REFRESH_SECRET: "refresh".repeat(12),
      JWT_ISSUER: "buddyscript-test", JWT_AUDIENCE: "buddyscript-test-web", COOKIE_SECURE: "false",
      CURSOR_SIGNING_SECRET: "cursor".repeat(12),
    });
    database = createDatabaseClient(testDatabaseUrl, pino({ level: "silent" }));
    const apiRouter = Router();
    apiRouter.use("/auth", createAuthRouter(database, environment));
    apiRouter.use("/posts", createPostRouter(database, environment));
    const readiness = new ReadinessState(); readiness.markReady();
    application = createApp({ environment, readiness, apiRouter, logger: pino({ level: "silent" }) });
  });

  afterAll(async () => {
    await database.post.deleteMany({ where: { id: { in: createdPostIds } } });
    await database.$disconnect();
  });

  it("requires authentication for the feed", async () => {
    expect((await request(application).get("/api/v1/posts")).status).toBe(401);
  });

  it("creates, paginates, authorizes, and reacts to posts", async () => {
    const alex = request.agent(application); const karim = request.agent(application);
    const alexLogin = await login(alex, "alex@buddy.test"); const karimLogin = await login(karim, "karim@buddy.test");
    const alexCsrf = csrfCookie(alexLogin); const karimCsrf = csrfCookie(karimLogin);

    expect((await alex.post("/api/v1/posts").send({ body: "Missing CSRF", visibility: "public" })).status).toBe(403);
    const privatePost = await alex.post("/api/v1/posts").set("x-csrf-token", alexCsrf).send({ body: "Phase 4 private post", visibility: "private" });
    const publicPost = await alex.post("/api/v1/posts").set("x-csrf-token", alexCsrf).send({ body: "Phase 4 public post", visibility: "public" });
    expect(privatePost.status).toBe(201); expect(publicPost.status).toBe(201);
    const privateId = dataId(privatePost); const publicId = dataId(publicPost); createdPostIds.push(privateId, publicId);

    const firstPage = await alex.get("/api/v1/posts?limit=1");
    expect(firstPage.status).toBe(200);
    const firstBody = firstPage.body as FeedBody;
    expect(firstBody.data.items).toHaveLength(1); expect(firstBody.data.nextCursor).toEqual(expect.any(String));
    if (firstBody.data.nextCursor === null) throw new Error("Expected a next cursor");
    const secondPage = await alex.get(`/api/v1/posts?limit=1&cursor=${encodeURIComponent(firstBody.data.nextCursor)}`);
    const secondBody = secondPage.body as FeedBody;
    expect(secondBody.data.items[0]?.id).not.toBe(firstBody.data.items[0]?.id);

    const karimFeed = (await karim.get("/api/v1/posts")).body as FeedBody;
    expect(karimFeed.data.items.some(({ id }) => id === publicId)).toBe(true);
    expect(karimFeed.data.items.some(({ id }) => id === privateId)).toBe(false);
    expect((await karim.post(`/api/v1/posts/${privateId}/like`).set("x-csrf-token", karimCsrf)).status).toBe(404);
    expect((await karim.get(`/api/v1/posts/${privateId}/likers`)).status).toBe(404);

    const concurrentLikes = await Promise.all([
      alex.post(`/api/v1/posts/${publicId}/like`).set("x-csrf-token", alexCsrf),
      alex.post(`/api/v1/posts/${publicId}/like`).set("x-csrf-token", alexCsrf),
    ]);
    expect(concurrentLikes.map(({ status }) => status)).toEqual([200, 200]);
    expect(concurrentLikes.map((response) => (response.body as ReactionBody).data.likeCount)).toEqual([1, 1]);

    const likers = await alex.get(`/api/v1/posts/${publicId}/likers?limit=1`);
    const likerItems = (likers.body as LikersBody).data.items;
    expect(likerItems).toEqual([expect.objectContaining({ firstName: "Alex" })]);
    expect(likerItems[0]).not.toHaveProperty("email");
    const unlike = await alex.delete(`/api/v1/posts/${publicId}/like`).set("x-csrf-token", alexCsrf);
    const unlikeAgain = await alex.delete(`/api/v1/posts/${publicId}/like`).set("x-csrf-token", alexCsrf);
    expect((unlike.body as ReactionBody).data).toEqual({ liked: false, likeCount: 0 });
    expect((unlikeAgain.body as ReactionBody).data).toEqual({ liked: false, likeCount: 0 });

    expect((await alex.get("/api/v1/posts?cursor=tampered.cursor")).status).toBe(400);
  });
});

async function login(agent: ReturnType<typeof request.agent>, email: string): Promise<Response> {
  const response = await agent.post("/api/v1/auth/login").send({ email, password: "Password123!" });
  expect(response.status).toBe(200); return response;
}
function csrfCookie(response: Response): string {
  const values: unknown = response.headers["set-cookie"];
  if (!Array.isArray(values)) throw new Error("Expected cookies");
  const cookie = values.find((value: unknown): value is string => typeof value === "string" && value.startsWith("bs_csrf="));
  if (cookie === undefined) throw new Error("Expected CSRF cookie");
  return decodeURIComponent(cookie.slice("bs_csrf=".length).split(";", 1)[0] ?? "");
}
function dataId(response: Response): string {
  const body = response.body as { data: { id: string } }; return body.data.id;
}
interface FeedBody { data: { items: { id: string }[]; nextCursor: string | null } }
interface ReactionBody { data: { liked: boolean; likeCount: number } }
interface LikersBody { data: { items: { firstName: string; lastName: string }[]; nextCursor: string | null } }
