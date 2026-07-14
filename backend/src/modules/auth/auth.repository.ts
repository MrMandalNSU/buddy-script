import type { AccountStatus, User } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../infrastructure/database/client.js";
import { withTransaction } from "../../infrastructure/database/transaction.js";

export type AuthUserRecord = Pick<User, "id" | "firstName" | "lastName" | "email" | "avatarUrl" | "passwordHash" | "status" | "createdAt">;
export interface StoredSession {
  id: string; userId: string; familyId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null; persistent: boolean; userStatus: AccountStatus;
}
export interface NewSession {
  id: string; userId: string; familyId: string; tokenHash: string; expiresAt: Date; persistent: boolean; ipHash?: string; userAgentHash?: string;
}
export interface NewUser extends NewSession {
  firstName: string; lastName: string; email: string; emailNormalized: string; passwordHash: string; avatarUrl: string;
}

const authUserSelect = { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, passwordHash: true, status: true, createdAt: true } as const;

export class AuthRepository {
  constructor(readonly database: DatabaseClient) {}

  findUserByEmail(emailNormalized: string): Promise<AuthUserRecord | null> {
    return this.database.user.findUnique({ where: { emailNormalized }, select: authUserSelect });
  }

  findUserById(id: string): Promise<AuthUserRecord | null> {
    return this.database.user.findUnique({ where: { id }, select: authUserSelect });
  }

  createUserAndSession(input: NewUser): Promise<AuthUserRecord> {
    return withTransaction(this.database, async (transaction) => {
      const user = await transaction.user.create({
        data: {
          id: input.userId, firstName: input.firstName, lastName: input.lastName, email: input.email,
          emailNormalized: input.emailNormalized, passwordHash: input.passwordHash, avatarUrl: input.avatarUrl,
        },
        select: authUserSelect,
      });
      await transaction.refreshSession.create({ data: this.sessionData(input) });
      return user;
    });
  }

  async createSession(input: NewSession): Promise<void> {
    await this.database.refreshSession.create({ data: this.sessionData(input) });
  }

  async findSessionByHash(tokenHash: string): Promise<StoredSession | null> {
    const session = await this.database.refreshSession.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, familyId: true, tokenHash: true, expiresAt: true, revokedAt: true, persistent: true, user: { select: { status: true } } },
    });
    return session === null ? null : { ...session, userStatus: session.user.status };
  }

  rotateSession(oldSessionId: string, next: NewSession): Promise<boolean> {
    return withTransaction(this.database, async (transaction) => {
      const claimed = await transaction.refreshSession.updateMany({
        where: { id: oldSessionId, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      });
      if (claimed.count !== 1) return false;
      await transaction.refreshSession.create({ data: this.sessionData(next) });
      await transaction.refreshSession.update({ where: { id: oldSessionId }, data: { replacedById: next.id } });
      return true;
    });
  }

  async revokeSessionByHash(tokenHash: string): Promise<void> {
    await this.database.refreshSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.database.refreshSession.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.database.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private sessionData(input: NewSession) {
    return {
      id: input.id, userId: input.userId, familyId: input.familyId, tokenHash: input.tokenHash, expiresAt: input.expiresAt, persistent: input.persistent,
      ...(input.ipHash === undefined ? {} : { ipHash: input.ipHash }),
      ...(input.userAgentHash === undefined ? {} : { userAgentHash: input.userAgentHash }),
    };
  }
}
