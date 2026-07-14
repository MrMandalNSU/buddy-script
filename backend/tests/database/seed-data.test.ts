import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { demoCommentReactions, demoComments, demoPostReactions, demoPosts, demoSummary, demoUsers, validateDemoFixtures } from "../../prisma/seed-data.js";
import { ReactionType } from "../../src/generated/prisma/client.js";

describe("demo seed fixtures", () => {
  it("form a valid, varied graph", () => {
    expect(validateDemoFixtures).not.toThrow();
    expect(demoSummary).toEqual({ users: 8, posts: 10, publicPosts: 8, privatePosts: 2, comments: 9, replies: 6, postReactions: 12, commentReactions: 15 });
    expect(demoPosts.some((post) => post.body === null && post.image !== undefined)).toBe(true);
    expect(demoPosts.some((post) => post.image === undefined)).toBe(true);
    expect(demoComments.some((comment) => comment.parentId !== undefined)).toBe(true);
  });

  it("covers every reaction type on posts, comments, and replies", () => {
    const everyReaction = Object.values(ReactionType).sort();
    expect([...new Set(demoPostReactions.map(({ reactionType }) => reactionType))].sort()).toEqual(everyReaction);
    expect([...new Set(demoCommentReactions.map(({ reactionType }) => reactionType))].sort()).toEqual(everyReaction);
    const replies = new Set(demoComments.filter(({ parentId }) => parentId !== undefined).map(({ id }) => id));
    expect(demoCommentReactions.filter(({ targetId }) => replies.has(targetId))).toHaveLength(replies.size);
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
