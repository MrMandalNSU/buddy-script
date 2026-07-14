import express from "express";
import request, { type Response } from "supertest";
import { describe, expect, it } from "vitest";
import { loadEnvironment } from "../../config/env.js";
import type { AuthTokens } from "./auth.types.js";
import { AuthCookieService } from "./cookie.service.js";

const environment = loadEnvironment({ NODE_ENV: "test", COOKIE_SECURE: "false" });
const cookies = new AuthCookieService(environment);
const tokens: AuthTokens = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  csrfToken: "csrf-token",
  accessExpiresAt: new Date("2030-01-01T00:10:00.000Z"),
  refreshExpiresAt: new Date("2030-02-01T00:00:00.000Z"),
};

describe("auth cookies", () => {
  it.each([true, false])("sets persistent=%s cookies with the expected browser lifetime", async (persistent) => {
    const application = express();
    application.get("/cookies", (_request, response) => { cookies.set(response, tokens, persistent); response.status(204).end(); });

    const response = await request(application).get("/cookies");
    const values = setCookies(response);
    expect(values).toHaveLength(3);
    for (const value of values) {
      expect(value).toContain("SameSite=Strict");
      if (persistent) expect(value).toContain("Expires=");
      else expect(value).not.toContain("Expires=");
    }
  });
});

function setCookies(response: Response): string[] {
  const value: unknown = response.headers["set-cookie"];
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) throw new Error("Expected authentication cookies");
  return value;
}
