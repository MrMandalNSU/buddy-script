import { describe, expect, it } from "vitest";
import { NodeRateLimitStoreAdapter } from "./node-rate-limit-store.adapter.js";

describe("node rate-limit store", () => {
  it("increments and resets bounded counters", () => {
    const store = new NodeRateLimitStoreAdapter();
    expect(store.increment("login:user", 60_000).totalHits).toBe(1);
    expect(store.increment("login:user", 60_000).totalHits).toBe(2);
    store.decrement("login:user"); expect(store.increment("login:user", 60_000).totalHits).toBe(2);
    store.reset("login:user"); expect(store.increment("login:user", 60_000).totalHits).toBe(1); store.close();
  });
});
