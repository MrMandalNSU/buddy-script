import type { Environment } from "../../config/env.js";
import { TokenService } from "./token.service.js";

export function createTokenService(environment: Environment): TokenService {
  if (environment.jwtAccessSecret === undefined || environment.jwtRefreshSecret === undefined) throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required");
  return new TokenService({
    accessSecret: environment.jwtAccessSecret, refreshSecret: environment.jwtRefreshSecret,
    issuer: environment.jwtIssuer, audience: environment.jwtAudience, keyId: environment.jwtKeyId,
    accessTtlSeconds: environment.accessTokenTtlSeconds, refreshTtlSeconds: environment.refreshTokenTtlSeconds,
  });
}
