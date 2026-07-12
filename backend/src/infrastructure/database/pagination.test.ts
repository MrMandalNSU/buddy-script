import { describe, expect, it } from "vitest";
import { MAX_PAGE_SIZE, normalizePageLimit, takePage } from "./pagination.js";

describe("database pagination", () => {
  it("bounds requested page sizes", () => {
    expect(normalizePageLimit()).toBe(20);
    expect(normalizePageLimit(0)).toBe(20);
    expect(normalizePageLimit(10_000)).toBe(MAX_PAGE_SIZE);
  });

  it("detects an additional fetched row", () => {
    expect(takePage([1, 2, 3], 2)).toEqual({ items: [1, 2], hasMore: true });
  });
});
