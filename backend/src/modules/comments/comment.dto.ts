import type { CommentRecord } from "./comment.types.js";

export function commentDto(comment: CommentRecord) {
  return {
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId,
    depth: comment.depth,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    author: comment.author,
    engagement: {
      likeCount: comment.likeCount,
      replyCount: comment.replyCount,
      likedByViewer: comment.likedByViewer,
    },
  };
}
