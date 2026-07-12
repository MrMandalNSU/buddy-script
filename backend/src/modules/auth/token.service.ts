import { createHash, randomBytes } from "node:crypto";
import { decodeProtectedHeader, SignJWT, jwtVerify, type JWTVerifyOptions } from "jose";
import type { AccessClaims, AuthTokens, RefreshClaims } from "./auth.types.js";

export interface TokenConfiguration {
  accessSecret: string;
  refreshSecret: string;
  issuer: string;
  audience: string;
  keyId: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

export class TokenService {
  readonly #accessKey: Uint8Array;
  readonly #refreshKey: Uint8Array;

  constructor(readonly configuration: TokenConfiguration) {
    this.#accessKey = new TextEncoder().encode(configuration.accessSecret);
    this.#refreshKey = new TextEncoder().encode(configuration.refreshSecret);
  }

  createCsrfToken(): string { return randomBytes(32).toString("base64url"); }
  hashToken(token: string): string { return createHash("sha256").update(token).digest("hex"); }

  async issuePair(userId: string, sessionId: string, familyId: string): Promise<AuthTokens> {
    const csrfToken = this.createCsrfToken();
    const now = Math.floor(Date.now() / 1000);
    const accessExpiresAt = new Date((now + this.configuration.accessTtlSeconds) * 1000);
    const refreshExpiresAt = new Date((now + this.configuration.refreshTtlSeconds) * 1000);
    const common = { issuer: this.configuration.issuer, audience: this.configuration.audience, subject: userId };
    const accessToken = await new SignJWT({ type: "access", sid: sessionId, csrf: csrfToken })
      .setProtectedHeader({ alg: "HS512", typ: "JWT", kid: this.configuration.keyId })
      .setIssuer(common.issuer).setAudience(common.audience).setSubject(common.subject)
      .setJti(sessionId).setIssuedAt(now).setExpirationTime(Math.floor(accessExpiresAt.getTime() / 1000)).sign(this.#accessKey);
    const refreshToken = await new SignJWT({ type: "refresh", sid: sessionId, family: familyId, csrf: csrfToken })
      .setProtectedHeader({ alg: "HS512", typ: "JWT", kid: this.configuration.keyId })
      .setIssuer(common.issuer).setAudience(common.audience).setSubject(common.subject)
      .setJti(sessionId).setIssuedAt(now).setExpirationTime(Math.floor(refreshExpiresAt.getTime() / 1000)).sign(this.#refreshKey);
    return { accessToken, refreshToken, csrfToken, accessExpiresAt, refreshExpiresAt };
  }

  async verifyAccess(token: string): Promise<AccessClaims> {
    this.verifyKeyId(token);
    const { payload } = await jwtVerify(token, this.#accessKey, this.verificationOptions());
    if (payload.type !== "access" || typeof payload.sub !== "string" || typeof payload.sid !== "string" || typeof payload.csrf !== "string") throw new Error("Invalid access token claims");
    return { userId: payload.sub, sessionId: payload.sid, csrfToken: payload.csrf };
  }

  async verifyRefresh(token: string): Promise<RefreshClaims> {
    this.verifyKeyId(token);
    const { payload } = await jwtVerify(token, this.#refreshKey, this.verificationOptions());
    if (payload.type !== "refresh" || typeof payload.sub !== "string" || typeof payload.sid !== "string" || typeof payload.family !== "string" || typeof payload.csrf !== "string") throw new Error("Invalid refresh token claims");
    return { userId: payload.sub, sessionId: payload.sid, familyId: payload.family, csrfToken: payload.csrf };
  }

  private verificationOptions(): JWTVerifyOptions {
    return { issuer: this.configuration.issuer, audience: this.configuration.audience, algorithms: ["HS512"] };
  }

  private verifyKeyId(token: string): void {
    if (decodeProtectedHeader(token).kid !== this.configuration.keyId) throw new Error("Unknown signing key");
  }
}
