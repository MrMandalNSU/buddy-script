import type { ReactionType } from "../../generated/prisma/client.js";
import type { PostAuthor, ReactionBreakdown, ReactionState, ReactorRecord } from "../posts/post.types.js";

export interface CommentRecord {
  id: string;
  postId: string;
  parentId: string | null;
  depth: number;
  body: string;
  likeCount: number;
  replyCount: number;
  viewerReaction: ReactionType | null;
  reactionBreakdown: ReactionBreakdown;
  createdAt: Date;
  updatedAt: Date;
  author: PostAuthor;
}

export interface CommentLikerRecord { id: string; createdAt: Date; user: PostAuthor }
export type CommentReactionState = Omit<ReactionState, "reactionPreview">;
export type CommentReactorRecord = ReactorRecord;
export type CommentMutationResult =
  | { status: "not-found" }
  | { status: "forbidden" }
  | { status: "updated"; comment: CommentRecord }
  | { status: "deleted" };
