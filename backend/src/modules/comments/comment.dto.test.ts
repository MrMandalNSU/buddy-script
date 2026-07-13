import { describe, expect, it } from "vitest";
import { commentDto } from "./comment.dto.js";

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
      likedByViewer: true,
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
      engagement: { likeCount: 3, replyCount: 1, likedByViewer: true },
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:01:00.000Z",
    });
  });
});
