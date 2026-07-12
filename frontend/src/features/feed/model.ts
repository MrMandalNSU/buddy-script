import type { User } from "@/features/auth/types";
import type { Comment, Post, ReactionSummary, Reply } from "./types";

export const newestFirst = (posts: Post[]) => [...posts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
export const visibleTo = (posts: Post[], viewerId: string) => newestFirst(posts.filter((post) => post.visibility === "public" || post.author.id === viewerId));
export function toggleReaction(reactions: ReactionSummary, viewer: User): ReactionSummary {
  return reactions.likedByViewer ? { likedByViewer: false, users: reactions.users.filter((user) => user.id !== viewer.id) } : { likedByViewer: true, users: [viewer, ...reactions.users.filter((user) => user.id !== viewer.id)] };
}
export function updateComment(posts: Post[], postId: string, commentId: string, update: (comment: Comment) => Comment) {
  return posts.map((post) => post.id === postId ? { ...post, comments: post.comments.map((comment) => comment.id === commentId ? update(comment) : comment) } : post);
}
export function updateReply(posts: Post[], postId: string, commentId: string, replyId: string, update: (reply: Reply) => Reply) {
  return updateComment(posts, postId, commentId, (comment) => ({ ...comment, replies: comment.replies.map((reply) => reply.id === replyId ? update(reply) : reply) }));
}
