import { describe, expect, it, vi } from "vitest";
import { NodeCacheAdapter } from "./node-cache.adapter.js";

describe("Node cache adapter", () => {
  it("coalesces concurrent misses and invalidates by prefix", async () => {
    const cache = new NodeCacheAdapter(20); const loader = vi.fn(() => Promise.resolve(["post-1"]));
    const results = await Promise.all([cache.wrap("feed:public:21", 5, loader), cache.wrap("feed:public:21", 5, loader)]);
    expect(results).toEqual([["post-1"], ["post-1"]]); expect(loader).toHaveBeenCalledTimes(1);
    expect(cache.deleteByPrefix("feed:public:")).toBe(1); expect(cache.get("feed:public:21")).toBeUndefined();
    cache.close();
  });

  it("keeps values isolated from caller mutation", () => {
    const cache = new NodeCacheAdapter(20); const value = { ids: ["one"] }; cache.set("key", value, 5);
    value.ids.push("two"); expect(cache.get("key")).toEqual({ ids: ["one"] }); cache.close();
  });
});
