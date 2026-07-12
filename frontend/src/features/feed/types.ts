import type { User } from "@/features/auth/types";
export type Visibility = "public" | "private";
export type ReactionSummary = { likedByViewer: boolean; users: User[] };
export type Reply = { id: string; author: User; body: string; createdAt: string; reactions: ReactionSummary };
export type Comment = { id: string; author: User; body: string; createdAt: string; reactions: ReactionSummary; replies: Reply[] };
export type Post = { id: string; author: User; body: string; imageUrl?: string; visibility: Visibility; createdAt: string; reactions: ReactionSummary; comments: Comment[] };
export type PaginatedFeed = { items: Post[]; nextCursor: string | null };
export type CreatePostInput = { body: string; imageUrl?: string; visibility: Visibility };
