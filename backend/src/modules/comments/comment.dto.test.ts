import { describe, expect, it } from "vitest";
import { commentDto } from "./comment.dto.js";
import { ReactionType } from "../../generated/prisma/client.js";

describe("commentDto", () => {
  it("uses the canonical comment contract for embedded previews", () => {
    const createdAt = new Date("2026-07-14T00:00:00.000Z");
    const updatedAt = new Date("2026-07-14T00:01:00.000Z");

    expect(commentDto({
      id: "comment-id",
      postId: "post-id",
      parentId: null,
      depth: 0,
      body: "A useful comment",
      likeCount: 3,
      replyCount: 1,
      viewerReaction: ReactionType.LOVE,
      reactionBreakdown: { LIKE: 0, LOVE: 3, CARE: 0, HAHA: 0, WOW: 0, SAD: 0, ANGRY: 0 },
      createdAt,
      updatedAt,
      author: { id: "user-id", firstName: "Alex", lastName: "Morgan", avatarUrl: null },
    })).toEqual({
      id: "comment-id",
      postId: "post-id",
      parentId: null,
      depth: 0,
      body: "A useful comment",
      author: { id: "user-id", firstName: "Alex", lastName: "Morgan", avatarUrl: null },
      engagement: {
        likeCount: 3,
        replyCount: 1,
        likedByViewer: true,
        reactionCount: 3,
        viewerReaction: "love",
        reactionBreakdown: { like: 0, love: 3, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
      },
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:01:00.000Z",
    });
  });
});
