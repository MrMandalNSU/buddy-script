import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { demoComments, demoPosts, demoSummary, demoUsers, validateDemoFixtures } from "../../prisma/seed-data.js";

describe("demo seed fixtures", () => {
  it("form a valid, varied graph", () => {
    expect(validateDemoFixtures).not.toThrow();
    expect(demoSummary).toEqual({ users: 8, posts: 10, publicPosts: 8, privatePosts: 2, comments: 9, replies: 6, postLikes: 12, commentLikes: 9 });
    expect(demoPosts.some((post) => post.body === null && post.image !== undefined)).toBe(true);
    expect(demoPosts.some((post) => post.image === undefined)).toBe(true);
    expect(demoComments.some((comment) => comment.parentId !== undefined)).toBe(true);
  });

  it("references stock assets copied into the frontend", () => {
    const assetPath = (url: string): string => resolve(process.cwd(), "../frontend/public", url.replace(/^\//, ""));
    for (const user of demoUsers) expect(existsSync(assetPath(user.avatarUrl)), user.avatarUrl).toBe(true);
    for (const post of demoPosts) {
      if (post.image === undefined) continue;
      const path = assetPath(post.image.url);
      expect(existsSync(path), post.image.url).toBe(true);
      expect(statSync(path).size, post.image.url).toBe(post.image.bytes);
    }
  });
});
