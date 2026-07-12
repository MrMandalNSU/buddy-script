import { createHash } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import { AccountStatus } from "../../generated/prisma/client.js";
import { isUniqueConstraintError } from "../../infrastructure/database/prisma-errors.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuthResult, ClientMetadata, LoginInput, PublicUser, RegisterInput } from "./auth.types.js";
import type { AuthRepository, AuthUserRecord, NewSession } from "./auth.repository.js";
import { hashPassword, verifyPassword } from "./password.service.js";
import type { TokenService } from "./token.service.js";

export class AuthService {
  constructor(readonly repository: AuthRepository, readonly tokens: TokenService) {}

  async register(input: RegisterInput, metadata: ClientMetadata): Promise<AuthResult> {
    const userId = uuidv7(); const sessionId = uuidv7(); const familyId = uuidv7();
    const issued = await this.tokens.issuePair(userId, sessionId, familyId);
    try {
      const user = await this.repository.createUserAndSession({
        id: sessionId, userId, familyId, tokenHash: this.tokens.hashToken(issued.refreshToken), expiresAt: issued.refreshExpiresAt,
        firstName: input.firstName.trim(), lastName: input.lastName.trim(), email: input.email.trim(),
        emailNormalized: normalizeEmail(input.email), passwordHash: await hashPassword(input.password), ...this.hashMetadata(metadata),
      });
      return { user: toPublicUser(user), tokens: issued };
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new AppError(409, "BAD_REQUEST", "An account with this email already exists");
      throw error;
    }
  }

  async login(input: LoginInput, metadata: ClientMetadata): Promise<AuthResult> {
    const user = await this.repository.findUserByEmail(normalizeEmail(input.email));
    const passwordValid = await verifyPassword(user?.passwordHash, input.password);
    if (!passwordValid || user?.status !== AccountStatus.ACTIVE) throw invalidCredentials();
    const sessionId = uuidv7(); const familyId = uuidv7();
    const issued = await this.tokens.issuePair(user.id, sessionId, familyId);
    await this.repository.createSession({
      id: sessionId, userId: user.id, familyId, tokenHash: this.tokens.hashToken(issued.refreshToken),
      expiresAt: issued.refreshExpiresAt, ...this.hashMetadata(metadata),
    });
    return { user: toPublicUser(user), tokens: issued };
  }

  async refresh(rawToken: string, metadata: ClientMetadata): Promise<AuthResult> {
    let claims;
    try { claims = await this.tokens.verifyRefresh(rawToken); }
    catch { throw new AppError(401, "UNAUTHORIZED", "Authentication is required"); }
    const stored = await this.repository.findSessionByHash(this.tokens.hashToken(rawToken));
    const compromised = stored?.id !== claims.sessionId || stored.userId !== claims.userId || stored.familyId !== claims.familyId || stored.revokedAt !== null || stored.expiresAt <= new Date();
    if (compromised) {
      await this.repository.revokeFamily(claims.familyId);
      throw new AppError(401, "UNAUTHORIZED", "The session is no longer valid");
    }
    if (stored.userStatus !== AccountStatus.ACTIVE) throw new AppError(403, "FORBIDDEN", "The account is disabled");
    const user = await this.repository.findUserById(claims.userId);
    if (user === null) throw new AppError(401, "UNAUTHORIZED", "The session is no longer valid");
    const nextSessionId = uuidv7();
    const issued = await this.tokens.issuePair(user.id, nextSessionId, claims.familyId);
    const next: NewSession = {
      id: nextSessionId, userId: user.id, familyId: claims.familyId, tokenHash: this.tokens.hashToken(issued.refreshToken),
      expiresAt: issued.refreshExpiresAt, ...this.hashMetadata(metadata),
    };
    const rotated = await this.repository.rotateSession(stored.id, next);
    if (!rotated) {
      await this.repository.revokeFamily(claims.familyId);
      throw new AppError(401, "UNAUTHORIZED", "Refresh token reuse was detected");
    }
    return { user: toPublicUser(user), tokens: issued };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    await this.repository.revokeSessionByHash(this.tokens.hashToken(rawRefreshToken));
  }

  logoutAll(userId: string): Promise<void> { return this.repository.revokeAllForUser(userId); }

  async currentUser(userId: string): Promise<PublicUser> {
    const user = await this.repository.findUserById(userId);
    if (user?.status !== AccountStatus.ACTIVE) throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
    return toPublicUser(user);
  }

  private hashMetadata(metadata: ClientMetadata): Pick<NewSession, "ipHash" | "userAgentHash"> {
    const hash = (value: string) => createHash("sha256").update(value).digest("hex");
    return {
      ...(metadata.ipAddress === undefined ? {} : { ipHash: hash(metadata.ipAddress) }),
      ...(metadata.userAgent === undefined ? {} : { userAgentHash: hash(metadata.userAgent) }),
    };
  }
}

export function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
function invalidCredentials(): AppError { return new AppError(401, "UNAUTHORIZED", "Invalid email or password"); }
function toPublicUser(user: AuthUserRecord): PublicUser {
  return { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, avatarUrl: user.avatarUrl, createdAt: user.createdAt.toISOString() };
}
