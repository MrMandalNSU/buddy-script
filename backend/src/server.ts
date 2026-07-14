import "dotenv/config";
import { createServer, type Server } from "node:http";
import { createApp } from "./app.js";
import { loadEnvironment } from "./config/env.js";
import { ReadinessState } from "./infrastructure/lifecycle/readiness.js";
import { createLogger } from "./infrastructure/logging/logger.js";
import { createDatabaseClient, verifyDatabaseConnection } from "./infrastructure/database/client.js";
import { requireDatabaseUrl } from "./infrastructure/database/database-url.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createPostRouter } from "./modules/posts/post.routes.js";
import { createCommentRouter } from "./modules/comments/comment.routes.js";
import { createCloudinaryService } from "./modules/uploads/cloudinary.service.js";
import { createUploadRouter } from "./modules/uploads/upload.routes.js";
import { NodeCacheAdapter } from "./infrastructure/cache/node-cache.adapter.js";
import { Router } from "express";

const environment = loadEnvironment();
const logger = createLogger(environment);
const readiness = new ReadinessState();
const database = createDatabaseClient(requireDatabaseUrl(environment.databaseUrl), logger);
const apiRouter = Router();
const cloudinary = createCloudinaryService(environment);
const cache = environment.cacheEnabled ? new NodeCacheAdapter(environment.cacheMaxKeys) : undefined;
apiRouter.use("/auth", createAuthRouter(database, environment));
apiRouter.use(createCommentRouter(database, environment));
apiRouter.use("/posts", createPostRouter(database, environment, cloudinary, cache, logger));
if (cloudinary !== undefined) apiRouter.use("/uploads", createUploadRouter(cloudinary, environment));
const app = createApp({ environment, logger, readiness, apiRouter });
const server = createServer(app);
let shuttingDown = false;

server.requestTimeout = 30_000;
server.headersTimeout = 35_000;
server.keepAliveTimeout = 5_000;

function terminate(code: number): never {
  process.exitCode = code;
  process.exit();
}

function closeServer(httpServer: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    httpServer.close((error) => error === undefined ? resolve() : reject(error));
    httpServer.closeIdleConnections();
  });
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  readiness.markNotReady();
  logger.info({ signal }, "Graceful shutdown started");

  const deadline = setTimeout(() => {
    logger.fatal("Graceful shutdown timed out");
    terminate(1);
  }, environment.shutdownTimeoutMs);
  deadline.unref();

  try {
    await closeServer(server);
    await database.$disconnect();
    cache?.close();
    clearTimeout(deadline);
    logger.info("Graceful shutdown completed");
  } catch (error) {
    logger.error({ err: error }, "Graceful shutdown failed");
    terminate(1);
  }
}

server.on("error", (error) => {
  logger.fatal({ err: error }, "HTTP server error");
  terminate(1);
});

async function start(): Promise<void> {
  await verifyDatabaseConnection(database);
  server.listen(environment.port, () => {
    readiness.markReady();
    logger.info({ port: environment.port }, "BuddyScript API is ready");
  });
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { void shutdown(signal); });
}

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  void shutdown("SIGTERM").finally(() => terminate(1));
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled rejection");
  void shutdown("SIGTERM").finally(() => terminate(1));
});

void start().catch((error: unknown) => {
  logger.fatal({ err: error }, "Application startup failed");
  void database.$disconnect().finally(() => terminate(1));
});
