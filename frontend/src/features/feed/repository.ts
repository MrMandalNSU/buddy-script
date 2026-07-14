import { apiRequest } from "@/shared/api/client";
import { commentSchema, likerSchema, pageSchema, postSchema, reactionSchema, reactionStateSchema, reactorSchema } from "./schemas";
import type { Comment, CreatePostInput, Liker, Page, Post, ReactionState, ReactionType, Reactor, UpdatePostInput } from "./types";
const query = (cursor?: string, limit = 20) => `?limit=${limit}${cursor === undefined ? "" : `&cursor=${encodeURIComponent(cursor)}`}`;
export const feedRepository = {
  list: (cursor?: string) => apiRequest<Page<Post>>(`/api/v1/posts${query(cursor)}`, { schema: pageSchema(postSchema) }),
  create: (input: CreatePostInput) => apiRequest<Post>("/api/v1/posts", { method: "POST", body: input, schema: postSchema }),
  update: (postId: string, input: UpdatePostInput, signal?: AbortSignal) => apiRequest<Post>(`/api/v1/posts/${encodeURIComponent(postId)}`, { method: "PATCH", body: input, schema: postSchema, signal }),
  delete: (postId: string) => apiRequest<void>(`/api/v1/posts/${encodeURIComponent(postId)}`, { method: "DELETE" }),
  setPostLike: (postId: string, liked: boolean) => apiRequest<{ liked: boolean; likeCount: number }>(`/api/v1/posts/${encodeURIComponent(postId)}/like`, { method: liked ? "POST" : "DELETE", schema: reactionSchema }),
  setPostReaction: (postId: string, reaction: ReactionType | null) => apiRequest<ReactionState>(`/api/v1/posts/${encodeURIComponent(postId)}/reaction`, { method: reaction === null ? "DELETE" : "PUT", ...(reaction === null ? {} : { body: { reaction } }), schema: reactionStateSchema }),
  comments: (postId: string, cursor?: string) => apiRequest<Page<Comment>>(`/api/v1/posts/${encodeURIComponent(postId)}/comments${query(cursor)}`, { schema: pageSchema(commentSchema) }),
  addComment: (postId: string, body: string) => apiRequest<Comment>(`/api/v1/posts/${encodeURIComponent(postId)}/comments`, { method: "POST", body: { body }, schema: commentSchema }),
  replies: (commentId: string, cursor?: string) => apiRequest<Page<Comment>>(`/api/v1/comments/${encodeURIComponent(commentId)}/replies${query(cursor)}`, { schema: pageSchema(commentSchema) }),
  addReply: (commentId: string, body: string) => apiRequest<Comment>(`/api/v1/comments/${encodeURIComponent(commentId)}/replies`, { method: "POST", body: { body }, schema: commentSchema }),
  setCommentLike: (commentId: string, liked: boolean) => apiRequest<{ liked: boolean; likeCount: number }>(`/api/v1/comments/${encodeURIComponent(commentId)}/like`, { method: liked ? "POST" : "DELETE", schema: reactionSchema }),
  setCommentReaction: (commentId: string, reaction: ReactionType | null) => apiRequest<ReactionState>(`/api/v1/comments/${encodeURIComponent(commentId)}/reaction`, { method: reaction === null ? "DELETE" : "PUT", ...(reaction === null ? {} : { body: { reaction } }), schema: reactionStateSchema }),
  updateComment: (commentId: string, body: string) => apiRequest<Comment>(`/api/v1/comments/${encodeURIComponent(commentId)}`, { method: "PATCH", body: { body }, schema: commentSchema }),
  deleteComment: (commentId: string) => apiRequest<void>(`/api/v1/comments/${encodeURIComponent(commentId)}`, { method: "DELETE" }),
  postLikers: (postId: string, cursor?: string) => apiRequest<Page<Liker>>(`/api/v1/posts/${encodeURIComponent(postId)}/likers${query(cursor)}`, { schema: pageSchema(likerSchema) }),
  commentLikers: (commentId: string, cursor?: string) => apiRequest<Page<Liker>>(`/api/v1/comments/${encodeURIComponent(commentId)}/likers${query(cursor)}`, { schema: pageSchema(likerSchema) }),
  postReactors: (postId: string, cursor?: string) => apiRequest<Page<Reactor>>(`/api/v1/posts/${encodeURIComponent(postId)}/reactors${query(cursor)}`, { schema: pageSchema(reactorSchema) }),
  commentReactors: (commentId: string, cursor?: string) => apiRequest<Page<Reactor>>(`/api/v1/comments/${encodeURIComponent(commentId)}/reactors${query(cursor)}`, { schema: pageSchema(reactorSchema) }),
};
export const feedKeys = { all: ["feed"] as const, comments: (postId: string) => ["comments", postId] as const, replies: (commentId: string) => ["replies", commentId] as const, likers: (kind: "post" | "comment", id: string) => ["likers", kind, id] as const, reactors: (kind: "post" | "comment", id: string) => ["reactors", kind, id] as const };
