import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type Express, type Router } from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import type { Environment } from "./config/env.js";
import type { ReadinessState } from "./infrastructure/lifecycle/readiness.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import { createHttpLogger } from "./middleware/http-logger.js";
import { notFound } from "./middleware/not-found.js";
import { requestContext } from "./middleware/request-context.js";
import { createOriginGuard } from "./middleware/origin-guard.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { createOpenApiRouter } from "./routes/openapi.routes.js";
import { createMetricsRouter } from "./routes/metrics.routes.js";
import { metricsMiddleware } from "./infrastructure/metrics/metrics.js";
import { AppError } from "./shared/errors/app-error.js";

export interface ApplicationDependencies {
  environment: Environment;
  logger: Logger;
  readiness: ReadinessState;
  apiRouter?: Router;
}

export function createApp({ environment, logger, readiness, apiRouter }: ApplicationDependencies): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", environment.trustProxy);

  app.use(requestContext);
  app.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(createHttpLogger(logger));
  app.use(metricsMiddleware);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (origin === undefined || environment.allowedOrigins.has(origin)) return callback(null, true);
      return callback(new AppError(403, "FORBIDDEN", "Origin is not allowed"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
    maxAge: 600,
  }));
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(cookieParser());

  app.use("/health", createHealthRouter(readiness));
  app.use("/docs", createOpenApiRouter());
  app.use("/metrics", createMetricsRouter());
  if (apiRouter !== undefined) app.use("/api/v1", createOriginGuard(environment), apiRouter);

  app.use(notFound);
  app.use(createErrorHandler(logger, environment.nodeEnv !== "production"));
  return app;
}
