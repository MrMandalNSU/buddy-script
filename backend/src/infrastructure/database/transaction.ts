import type { Prisma } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "./client.js";

export type TransactionWork<T> = (transaction: Prisma.TransactionClient) => Promise<T>;

export function withTransaction<T>(client: DatabaseClient, work: TransactionWork<T>): Promise<T> {
  return client.$transaction(work, {
    isolationLevel: "ReadCommitted",
    maxWait: 5_000,
    timeout: 10_000,
  });
}
