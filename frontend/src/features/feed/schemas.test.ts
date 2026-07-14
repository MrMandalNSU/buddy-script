import { describe, expect, it } from "vitest";
import { pageSchema, postSchema } from "./schemas";

const author = { id: "user-1", firstName: "Alex", lastName: "Morgan", avatarUrl: null };
const breakdown = { like: 2, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 };
const canonicalComment = {
  id: "comment-1",
  postId: "post-1",
  parentId: null,
  depth: 0,
  body: "A canonical preview",
  author,
  engagement: { likeCount: 2, replyCount: 1, likedByViewer: true, reactionCount: 2, viewerReaction: "like", reactionBreakdown: breakdown },
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:01:00.000Z",
};
const post = {
  id: "post-1",
  body: "Post body",
  visibility: "public",
  image: null,
  author,
  engagement: { likeCount: 3, commentCount: 1, likedByViewer: false, reactionCount: 3, viewerReaction: null, reactionBreakdown: { ...breakdown, like: 1, love: 2 } },
  reactionPreview: [{ user: author, reaction: "love", reactedAt: "2026-07-14T00:01:00.000Z" }],
  commentPreview: [canonicalComment],
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:01:00.000Z",
};

describe("feed response schemas", () => {
  it("accepts a page with canonical embedded comment previews", () => {
    expect(pageSchema(postSchema).parse({ items: [post], nextCursor: null })).toEqual({ items: [post], nextCursor: null });
  });

  it("rejects the legacy flattened comment preview contract", () => {
    const legacy = {
      id: canonicalComment.id,
      body: canonicalComment.body,
      author,
      likeCount: 2,
      replyCount: 1,
      likedByViewer: true,
      createdAt: canonicalComment.createdAt,
    };
    expect(postSchema.safeParse({ ...post, commentPreview: [legacy] }).success).toBe(false);
  });
});
