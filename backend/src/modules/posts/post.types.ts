import { ReactionType, type PostVisibility } from "../../generated/prisma/client.js";

export interface CreatePostInput {
  body?: string;
  visibility: PostVisibility;
  image?: { publicId: string; secureUrl: string; version: number; width: number; height: number; bytes: number; format: string };
}
export interface PostAuthor { id: string; firstName: string; lastName: string; avatarUrl: string | null }
export type ReactionBreakdown = Record<ReactionType, number>;
export interface ReactorRecord { id: string; updatedAt: Date; reactionType: ReactionType; user: PostAuthor }
export interface ReactionPreviewRecord { reactionType: ReactionType; updatedAt: Date; user: PostAuthor }
export interface CommentPreview {
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
export interface PostRecord {
  id: string; body: string | null; visibility: PostVisibility; createdAt: Date; updatedAt: Date;
  image: null | { publicId: string; secureUrl: string; version: number; width: number; height: number; bytes: number; format: string };
  likeCount: number; commentCount: number; viewerReaction: ReactionType | null; reactionBreakdown: ReactionBreakdown;
  reactionPreview: ReactionPreviewRecord[]; author: PostAuthor; commentPreview: CommentPreview[];
}
export interface LikerRecord { id: string; createdAt: Date; user: PostAuthor }
export interface ReactionState {
  reactionCount: number;
  viewerReaction: ReactionType | null;
  reactionBreakdown: ReactionBreakdown;
  reactionPreview: ReactionPreviewRecord[];
}

export const emptyReactionBreakdown = (): ReactionBreakdown => ({
  [ReactionType.LIKE]: 0,
  [ReactionType.LOVE]: 0,
  [ReactionType.CARE]: 0,
  [ReactionType.HAHA]: 0,
  [ReactionType.WOW]: 0,
  [ReactionType.SAD]: 0,
  [ReactionType.ANGRY]: 0,
});
