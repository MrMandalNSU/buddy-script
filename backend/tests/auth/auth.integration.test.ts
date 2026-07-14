import "dotenv/config";
import { Router } from "express";
import pino from "pino";
import request, { type Response, type Test } from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { loadEnvironment, type Environment } from "../../src/config/env.js";
import { createDatabaseClient, type DatabaseClient } from "../../src/infrastructure/database/client.js";
import { ReadinessState } from "../../src/infrastructure/lifecycle/readiness.js";
import { createAuthRouter } from "../../src/modules/auth/auth.routes.js";

const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_DEV;
const databaseSuite = process.env.RUN_DATABASE_TESTS === "true" && databaseUrl !== undefined ? describe : describe.skip;
const testDatabaseUrl = databaseUrl ?? "postgresql://integration-tests-disabled.invalid/buddy";

describe("registration password validation pipeline", () => {
  const environment = loadEnvironment({
    NODE_ENV: "test", DATABASE_URL: testDatabaseUrl, ALLOWED_ORIGINS: "http://localhost:3000",
    JWT_ACCESS_SECRET: "access".repeat(12), JWT_REFRESH_SECRET: "refresh".repeat(12),
    JWT_ISSUER: "buddyscript-test", JWT_AUDIENCE: "buddyscript-test-web", COOKIE_SECURE: "false",
  });
  const database = Object.create(null) as DatabaseClient;
  const apiRouter = Router(); apiRouter.use("/auth", createAuthRouter(database, environment));
  const readiness = new ReadinessState(); readiness.markReady();
  const application = createApp({ environment, readiness, apiRouter, logger: pino({ level: "silent" }) });

  it("rejects a direct API request that bypasses frontend password validation", async () => {
    const response = await request(application).post("/api/v1/auth/register").send({
      firstName: "Direct", lastName: "Caller", email: "direct-caller@buddy.test", password: "lowercase!",
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR", message: "Request validation failed" } });
  });
});

databaseSuite("authentication API", { concurrent: false }, () => {
  let database: DatabaseClient;
  let environment: Environment;
  let application: ReturnType<typeof createApp>;
  const email = `phase3-${Date.now()}@buddy.test`;

  beforeAll(() => {
    environment = loadEnvironment({
      NODE_ENV: "test", DATABASE_URL: testDatabaseUrl, ALLOWED_ORIGINS: "http://localhost:3000",
      JWT_ACCESS_SECRET: "access".repeat(12), JWT_REFRESH_SECRET: "refresh".repeat(12),
      JWT_ISSUER: "buddyscript-test", JWT_AUDIENCE: "buddyscript-test-web", COOKIE_SECURE: "false",
    });
    database = createDatabaseClient(testDatabaseUrl, pino({ level: "silent" }));
    const apiRouter = Router(); apiRouter.use("/auth", createAuthRouter(database, environment));
    const readiness = new ReadinessState(); readiness.markReady();
    application = createApp({ environment, readiness, apiRouter, logger: pino({ level: "silent" }) });
  });

  afterAll(async () => {
    await database.user.deleteMany({ where: { emailNormalized: email } });
    await database.$disconnect();
  });

  it("rejects invalid registration bodies with field-safe details", async () => {
    const response = await request(application).post("/api/v1/auth/register").send({ email: "bad" });
    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });

  it("registers, authenticates, rotates, detects reuse, and revokes all sessions", async () => {
    const agent = request.agent(application);
    const registration = await agent.post("/api/v1/auth/register").send({ firstName: "Phase", lastName: "Three", email, password: "Password123!" });
    expect(registration.status).toBe(201);
    expect(registration.body).toMatchObject({ success: true, data: { user: { email } } });
    const originalCookies = cookieHeader(registration);
    const originalCsrf = csrfCookie(registration);
    const accessCookie = setCookies(registration).find((cookie) => cookie.startsWith("bs_access="));
    const refreshCookie = setCookies(registration).find((cookie) => cookie.startsWith("bs_refresh="));
    expect(accessCookie).toContain("HttpOnly"); expect(accessCookie).toContain("SameSite=Strict"); expect(accessCookie).toContain("Path=/");
    expect(refreshCookie).toContain("HttpOnly"); expect(refreshCookie).toContain("Path=/api/v1/auth");
    expect(accessCookie).toContain("Expires="); expect(refreshCookie).toContain("Expires=");

    const duplicate = await request(application).post("/api/v1/auth/register").send({ firstName: "Phase", lastName: "Three", email, password: "Password123!" });
    expect(duplicate.status).toBe(409);

    expect((await agent.get("/api/v1/auth/me")).status).toBe(200);
    expect((await agent.post("/api/v1/auth/refresh")).status).toBe(403);

    const refreshed = await agent.post("/api/v1/auth/refresh").set("x-csrf-token", originalCsrf);
    expect(refreshed.status).toBe(200);
    const rotatedCsrf = csrfCookie(refreshed);

    const reused = await request(application).post("/api/v1/auth/refresh").set("Cookie", originalCookies).set("x-csrf-token", originalCsrf);
    expect(reused.status).toBe(401);
    expect((await agent.post("/api/v1/auth/refresh").set("x-csrf-token", rotatedCsrf)).status).toBe(401);

    const login = await agent.post("/api/v1/auth/login").send({ email, password: "Password123!" });
    expect(login.status).toBe(200);
    const concurrentCookies = cookieHeader(login); const concurrentCsrf = csrfCookie(login);
    const concurrent = await Promise.all([
      request(application).post("/api/v1/auth/refresh").set("Cookie", concurrentCookies).set("x-csrf-token", concurrentCsrf),
      request(application).post("/api/v1/auth/refresh").set("Cookie", concurrentCookies).set("x-csrf-token", concurrentCsrf),
    ]);
    expect(concurrent.map(({ status }) => status).sort()).toEqual([200, 401]);

    const sessionAgent = request.agent(application);
    const sessionLogin = await sessionAgent.post("/api/v1/auth/login").send({ email, password: "Password123!", remember: false });
    expect(sessionLogin.status).toBe(200);
    expect(setCookies(sessionLogin).every((cookie) => !cookie.includes("Expires="))).toBe(true);
    const sessionRefresh = await sessionAgent.post("/api/v1/auth/refresh").set("x-csrf-token", csrfCookie(sessionLogin));
    expect(sessionRefresh.status).toBe(200);
    expect(setCookies(sessionRefresh).every((cookie) => !cookie.includes("Expires="))).toBe(true);
    const registeredUser = await database.user.findUniqueOrThrow({ where: { emailNormalized: email }, select: { id: true } });
    expect(await database.refreshSession.count({ where: { userId: registeredUser.id, persistent: false } })).toBe(2);

    const finalLogin = await agent.post("/api/v1/auth/login").send({ email, password: "Password123!" });
    expect(finalLogin.status).toBe(200);
    const loginCsrf = csrfCookie(finalLogin);
    expect((await agent.post("/api/v1/auth/logout-all").set("x-csrf-token", loginCsrf)).status).toBe(204);
    expect((await agent.get("/api/v1/auth/me")).status).toBe(401);
  });

  it("uses a generic response for unknown accounts and wrong passwords", async () => {
    for (const operation of [
      request(application).post("/api/v1/auth/login").send({ email: "missing@buddy.test", password: "Password123!" }),
      request(application).post("/api/v1/auth/login").send({ email, password: "incorrect-password" }),
    ] satisfies Test[]) {
      const response = await operation;
      expect(response.status).toBe(401);
      const body = response.body as { error: { message: string } };
      expect(body.error.message).toBe("Invalid email or password");
    }
  });
});

function setCookies(response: Response): string[] {
  const value: unknown = response.headers["set-cookie"];
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) throw new Error("Expected authentication cookies");
  return value;
}
function cookieHeader(response: Response): string { return setCookies(response).map((cookie) => cookie.split(";", 1)[0]).join("; "); }
function csrfCookie(response: Response): string {
  const cookie = setCookies(response).find((value) => value.startsWith("bs_csrf="));
  if (cookie === undefined) throw new Error("Expected CSRF cookie");
  return decodeURIComponent(cookie.slice("bs_csrf=".length).split(";", 1)[0] ?? "");
}
