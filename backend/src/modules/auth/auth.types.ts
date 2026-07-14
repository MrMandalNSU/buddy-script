export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

export interface AuthResult {
  user: PublicUser;
  tokens: AuthTokens;
  persistent: boolean;
}

export interface LoginInput { email: string; password: string; remember: boolean }
export interface RegisterInput { firstName: string; lastName: string; email: string; password: string }

export interface ClientMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface AccessClaims {
  userId: string;
  sessionId: string;
  csrfToken: string;
}

export interface RefreshClaims extends AccessClaims {
  familyId: string;
}
