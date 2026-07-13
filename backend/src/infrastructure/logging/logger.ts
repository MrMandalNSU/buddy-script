import pino, { type Logger } from "pino";
import type { Environment } from "../../config/env.js";

const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers.x-csrf-token",
  "req.headers['x-csrf-token']",
  "res.headers.set-cookie",
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "DATABASE_URL",
  "DIRECT_URL",
];

export function createLogger(environment: Environment): Logger {
  const developmentTransport = environment.nodeEnv === "development"
    ? { transport: { target: "pino-pretty", options: { colorize: true, singleLine: true, translateTime: "SYS:standard" } } }
    : {};
  return pino({
    level: environment.logLevel,
    base: { service: "buddyscript-api", environment: environment.nodeEnv },
    redact: { paths: redactPaths, censor: "[REDACTED]" },
    ...developmentTransport,
  });
}
