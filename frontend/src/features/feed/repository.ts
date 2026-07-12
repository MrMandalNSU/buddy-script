import type { Result } from "@/shared/result";
import type { Comment, CreatePostInput, PaginatedFeed, Post, Reply } from "./types";
export interface FeedRepository {
  list(viewerId: string): Promise<Result<PaginatedFeed>>;
  create(input: CreatePostInput): Promise<Result<Post>>;
  togglePostLike(postId: string): Promise<Result<Post>>;
  addComment(postId: string, body: string): Promise<Result<Comment>>;
  toggleCommentLike(postId: string, commentId: string): Promise<Result<Comment>>;
  addReply(postId: string, commentId: string, body: string): Promise<Result<Reply>>;
  toggleReplyLike(postId: string, commentId: string, replyId: string): Promise<Result<Reply>>;
}
