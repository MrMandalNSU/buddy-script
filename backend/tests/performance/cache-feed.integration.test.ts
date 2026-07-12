import "dotenv/config";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { createDatabaseClient } from "../../src/infrastructure/database/client.js";
import { NodeCacheAdapter } from "../../src/infrastructure/cache/node-cache.adapter.js";
import { PostRepository } from "../../src/modules/posts/post.repository.js";
import { PostService } from "../../src/modules/posts/post.service.js";
import { CursorService } from "../../src/shared/pagination/cursor.service.js";

const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_DEV;
const databaseSuite = process.env.RUN_DATABASE_TESTS === "true" && databaseUrl !== undefined ? describe : describe.skip;

databaseSuite("public feed cache", () => {
  it("returns identical feed data with cache enabled and disabled", async () => {
    const database = createDatabaseClient(databaseUrl ?? "postgresql://disabled.invalid/db", pino({ level: "silent" }));
    const repository = new PostRepository(database); const cursors = new CursorService("cache-test-secret".repeat(3)); const cache = new NodeCacheAdapter(100);
    const uncached = new PostService(repository, cursors); const cached = new PostService(repository, cursors, undefined, cache, 5);
    const viewerId = "01900000-0000-7000-8000-000000000001";
    const [expected, first, second] = await Promise.all([uncached.list(viewerId, { limit: 20 }), cached.list(viewerId, { limit: 20 }), cached.list(viewerId, { limit: 20 })]);
    expect(first).toEqual(expected); expect(second).toEqual(expected); expect(cache.stats().keys).toBe(1);
    cache.close(); await database.$disconnect();
  });
});
