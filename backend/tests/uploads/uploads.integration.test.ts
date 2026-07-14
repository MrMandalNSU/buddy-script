import "dotenv/config";
import { v2 as cloudinarySdk } from "cloudinary";
import { Router } from "express";
import pino from "pino";
import request, { type Response } from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from "vitest";
import { createApp } from "../../src/app.js";
import { loadEnvironment, type Environment } from "../../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../../src/infrastructure/database/client.js";
import { ReadinessState } from "../../src/infrastructure/lifecycle/readiness.js";
import { createAuthRouter } from "../../src/modules/auth/auth.routes.js";
import { createPostRouter } from "../../src/modules/posts/post.routes.js";
import { CloudinaryService } from "../../src/modules/uploads/cloudinary.service.js";
import { createUploadRouter } from "../../src/modules/uploads/upload.routes.js";

const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_DEV;
const databaseSuite = process.env.RUN_DATABASE_TESTS === "true" && databaseUrl !== undefined ? describe : describe.skip;
const testDatabaseUrl = databaseUrl ?? "postgresql://integration-tests-disabled.invalid/buddy";

databaseSuite("signed image uploads", { concurrent: false }, () => {
  let database: DatabaseClient; let application: ReturnType<typeof createApp>; const createdPostIds: string[] = [];
  let cloudinary: CloudinaryService;
  let destroy: MockInstance<CloudinaryService["destroy"]>;
  const apiSecret = "cloudinary-test-secret";

  beforeAll(() => {
    const environment: Environment = loadEnvironment({
      NODE_ENV: "test", DATABASE_URL: testDatabaseUrl, ALLOWED_ORIGINS: "http://localhost:3000",
      JWT_ACCESS_SECRET: "access".repeat(12), JWT_REFRESH_SECRET: "refresh".repeat(12), CURSOR_SIGNING_SECRET: "cursor".repeat(12),
      JWT_ISSUER: "buddyscript-test", JWT_AUDIENCE: "buddyscript-test-web", COOKIE_SECURE: "false",
      CLOUDINARY_CLOUD_NAME: "test-cloud", CLOUDINARY_API_KEY: "test-key", CLOUDINARY_API_SECRET: apiSecret,
    });
    database = createDatabaseClient(testDatabaseUrl, pino({ level: "silent" }));
    cloudinary = new CloudinaryService("test-cloud", "test-key", apiSecret, "buddyscript", 5_000_000, () => 1_720_000_000_000);
    destroy = vi.spyOn(cloudinary, "destroy").mockResolvedValue();
    const apiRouter = Router(); apiRouter.use("/auth", createAuthRouter(database, environment));
    apiRouter.use("/posts", createPostRouter(database, environment, cloudinary)); apiRouter.use("/uploads", createUploadRouter(cloudinary, environment));
    const readiness = new ReadinessState(); readiness.markReady();
    application = createApp({ environment, readiness, apiRouter, logger: pino({ level: "silent" }) });
  });

  afterAll(async () => { await database.post.deleteMany({ where: { id: { in: createdPostIds } } }); await database.$disconnect(); });

  it("protects signatures and persists only verified upload metadata", async () => {
    const agent = request.agent(application); const login = await agent.post("/api/v1/auth/login").send({ email: "alex@buddy.test", password: "Password123!" });
    expect(login.status).toBe(200); const csrf = csrfCookie(login);
    expect((await agent.post("/api/v1/uploads/signature")).status).toBe(403);
    expect((await agent.post("/api/v1/uploads/signature").set("x-csrf-token", csrf)).status).toBe(200);

    const image = uploadResult("01900000-0000-7000-8000-000000000001");
    const created = await agent.post("/api/v1/posts").set("x-csrf-token", csrf).send({ visibility: "public", image });
    expect(created.status).toBe(201); const postId = (created.body as { data: { id: string } }).data.id; createdPostIds.push(postId);
    const stored = await database.post.findUniqueOrThrow({ where: { id: postId }, select: { body: true, imagePublicId: true, imageBytes: true } });
    expect(stored).toEqual({ body: null, imagePublicId: image.publicId, imageBytes: image.bytes });
    expect((await agent.post("/api/v1/posts").set("x-csrf-token", csrf).send({ visibility: "public", image: { ...image, signature: "tampered" } })).status).toBe(422);

    const replacement = uploadResult("01900000-0000-7000-8000-000000000001", "replacement");
    const replaced = await agent.patch(`/api/v1/posts/${postId}`).set("x-csrf-token", csrf).send({ image: replacement });
    expect(replaced.status).toBe(200);
    expect(replaced.body).toMatchObject({ data: { image: { publicId: replacement.publicId } } });
    expect(destroy).toHaveBeenCalledWith(image.publicId);
    expect((await agent.patch(`/api/v1/posts/${postId}`).set("x-csrf-token", csrf).send({ image: null })).status).toBe(422);

    const removed = await agent.patch(`/api/v1/posts/${postId}`).set("x-csrf-token", csrf).send({ body: "Keep the post", image: null });
    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({ data: { body: "Keep the post", image: null } });
    expect(destroy).toHaveBeenCalledWith(replacement.publicId);

    const deletableImage = uploadResult("01900000-0000-7000-8000-000000000001", "delete-me");
    const deletable = await agent.post("/api/v1/posts").set("x-csrf-token", csrf).send({ visibility: "public", image: deletableImage });
    expect(deletable.status).toBe(201);
    const deletableId = (deletable.body as { data: { id: string } }).data.id; createdPostIds.push(deletableId);
    expect((await agent.delete(`/api/v1/posts/${deletableId}`).set("x-csrf-token", csrf)).status).toBe(204);
    expect(destroy).toHaveBeenCalledWith(deletableImage.publicId);

    const cleanupFailureImage = uploadResult("01900000-0000-7000-8000-000000000001", "cleanup-failure");
    const cleanupFailurePost = await agent.post("/api/v1/posts").set("x-csrf-token", csrf).send({ visibility: "public", image: cleanupFailureImage });
    const cleanupFailureId = (cleanupFailurePost.body as { data: { id: string } }).data.id; createdPostIds.push(cleanupFailureId);
    destroy.mockRejectedValueOnce(new Error("Cloudinary unavailable"));
    expect((await agent.delete(`/api/v1/posts/${cleanupFailureId}`).set("x-csrf-token", csrf)).status).toBe(204);
    expect(await database.post.findUnique({ where: { id: cleanupFailureId } })).toBeNull();
  });

  function uploadResult(userId: string, name = "image") {
    const publicId = `buddyscript/users/${userId}/posts/${name}`; const version = 1;
    return {
      publicId, secureUrl: `https://res.cloudinary.com/test-cloud/image/upload/v1/${publicId}.jpg`, version,
      width: 1_200, height: 800, bytes: 120_000, format: "jpg",
      signature: cloudinarySdk.utils.api_sign_request({ public_id: publicId, version }, apiSecret),
    };
  }
});

function csrfCookie(response: Response): string {
  const cookies = response.headers["set-cookie"] as unknown as string[] | undefined;
  const value = cookies?.map((cookie) => cookie.split(";", 1)[0]).find((cookie) => cookie?.startsWith("bs_csrf="))?.split("=")[1];
  if (value === undefined) throw new Error("CSRF cookie missing");
  return decodeURIComponent(value);
}
