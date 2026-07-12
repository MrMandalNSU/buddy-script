import type { PostVisibility } from "../../generated/prisma/client.js";

export interface CreatePostInput {
  body?: string;
  visibility: PostVisibility;
  image?: { publicId: string; secureUrl: string; version: number; width: number; height: number; bytes: number; format: string };
}
export interface PostAuthor { id: string; firstName: string; lastName: string; avatarUrl: string | null }
export interface CommentPreview {
  id: string; body: string; createdAt: Date; likeCount: number; replyCount: number; likedByViewer: boolean; author: PostAuthor;
}
export interface PostRecord {
  id: string; body: string | null; visibility: PostVisibility; createdAt: Date; updatedAt: Date;
  image: null | { publicId: string; secureUrl: string; version: number; width: number; height: number; bytes: number; format: string };
  likeCount: number; commentCount: number; likedByViewer: boolean; author: PostAuthor; commentPreview: CommentPreview[];
}
export interface LikerRecord { id: string; createdAt: Date; user: PostAuthor }
export interface ReactionState { liked: boolean; likeCount: number }
