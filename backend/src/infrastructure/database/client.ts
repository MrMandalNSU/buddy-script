import { PrismaNeon } from "@prisma/adapter-neon";
import type { Logger } from "pino";
import { PrismaClient } from "../../generated/prisma/client.js";

export type DatabaseClient = PrismaClient;

export function createDatabaseClient(databaseUrl: string, logger: Logger): DatabaseClient {
  const adapter = new PrismaNeon(
    {
      connectionString: databaseUrl,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 10_000,
      max: 10,
    },
    {
      onPoolError: (error) => logger.error({ err: error }, "Neon connection pool error"),
      onConnectionError: (error) => logger.error({ err: error }, "Neon database connection error"),
    },
  );

  return new PrismaClient({ adapter, log: ["warn", "error"] });
}

export async function verifyDatabaseConnection(client: DatabaseClient): Promise<void> {
  await client.$queryRaw`SELECT 1`;
}
