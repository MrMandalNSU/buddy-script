import pino from "pino";
import { createApp } from "../../src/app.js";
import type { Environment } from "../../src/config/env.js";
import { ReadinessState } from "../../src/infrastructure/lifecycle/readiness.js";

export function createTestApp(ready = true) {
  const readiness = new ReadinessState();
  if (ready) readiness.markReady();
  const environment: Environment = {
    nodeEnv: "test",
    port: 4000,
    logLevel: "silent",
    trustProxy: false,
    allowedOrigins: new Set(["http://localhost:3000"]),
    shutdownTimeoutMs: 10_000,
    jwtIssuer: "buddyscript-api",
    jwtAudience: "buddyscript-web",
    jwtKeyId: "test-key",
    accessTokenTtlSeconds: 600,
    refreshTokenTtlSeconds: 2_592_000,
    cookieSecure: false,
    cursorSigningSecret: "cursor-test-secret".repeat(3),
    cloudinaryPostFolder: "buddyscript",
    cloudinaryMaxImageBytes: 5_000_000,
    cacheEnabled: false,
    cachePublicFeedTtlSeconds: 5,
    cacheMaxKeys: 1_000,
  };
  return createApp({ environment, readiness, logger: pino({ level: "silent" }) });
}
