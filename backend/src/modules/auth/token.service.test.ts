import { describe, expect, it } from "vitest";
import { TokenService } from "./token.service.js";

const service = new TokenService({
  accessSecret: "a".repeat(64), refreshSecret: "r".repeat(64), issuer: "test-issuer", audience: "test-audience",
  keyId: "test-key", accessTtlSeconds: 600, refreshTtlSeconds: 3_600,
});

describe("token service", () => {
  it("issues typed access and refresh tokens", async () => {
    const pair = await service.issuePair("user-id", "session-id", "family-id");
    await expect(service.verifyAccess(pair.accessToken)).resolves.toMatchObject({ userId: "user-id", sessionId: "session-id", csrfToken: pair.csrfToken });
    await expect(service.verifyRefresh(pair.refreshToken)).resolves.toMatchObject({ userId: "user-id", sessionId: "session-id", familyId: "family-id" });
  });

  it("does not accept a refresh token as an access token", async () => {
    const pair = await service.issuePair("user-id", "session-id", "family-id");
    await expect(service.verifyAccess(pair.refreshToken)).rejects.toThrow();
  });

  it("hashes tokens deterministically without retaining them", () => {
    expect(service.hashToken("secret-token")).toHaveLength(64);
    expect(service.hashToken("secret-token")).toBe(service.hashToken("secret-token"));
  });
});
