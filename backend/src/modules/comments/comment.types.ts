import type { PostAuthor, ReactionState } from "../posts/post.types.js";

export interface CommentRecord {
  id: string;
  postId: string;
  parentId: string | null;
  depth: number;
  body: string;
  likeCount: number;
  replyCount: number;
  likedByViewer: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: PostAuthor;
}

export interface CommentLikerRecord { id: string; createdAt: Date; user: PostAuthor }
export type CommentReactionState = ReactionState;
