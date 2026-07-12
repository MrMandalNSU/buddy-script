import type { User } from "@/features/auth/types";
import { fail, ok } from "@/shared/result";
import { newestFirst, toggleReaction, updateComment, updateReply, visibleTo } from "./model";
import type { FeedRepository } from "./repository";
import type { Comment, CreatePostInput, Post, Reply } from "./types";

export const currentUser: User = { id: "user-me", firstName: "Alex", lastName: "Morgan", email: "alex@buddy.test", avatarUrl: "/assets/txt_img.png", headline: "Product designer at BuddyScript" };
const karim: User = { id: "user-karim", firstName: "Karim", lastName: "Saif", email: "karim@buddy.test", avatarUrl: "/assets/post_img.png", headline: "Founder at Healthy Tracking" };
const radovan: User = { id: "user-radovan", firstName: "Radovan", lastName: "SkillArena", email: "radovan@buddy.test", avatarUrl: "/assets/Avatar.png", headline: "Founder & CEO at Trophy" };
const steve: User = { id: "user-steve", firstName: "Steve", lastName: "Jobs", email: "steve@buddy.test", avatarUrl: "/assets/people1.png", headline: "CEO of Apple" };
const reaction = (users: User[] = [], likedByViewer = false) => ({ users, likedByViewer });
let posts: Post[] = [
  { id: "post-2", author: currentUser, body: "A quiet preview of my new portfolio direction. Keeping this one private while I refine the details.", visibility: "private", createdAt: "2026-07-12T07:20:00Z", reactions: reaction([], false), comments: [] },
  { id: "post-1", author: karim, body: "Healthy Tracking App — a thoughtful way to build better habits and celebrate small wins every day.", imageUrl: "/assets/timeline_img.png", visibility: "public", createdAt: "2026-07-12T06:55:00Z", reactions: reaction([radovan, steve]), comments: [{ id: "comment-1", author: radovan, body: "The visual hierarchy feels clear and the progress view is especially useful.", createdAt: "2026-07-12T07:00:00Z", reactions: reaction([steve]), replies: [{ id: "reply-1", author: karim, body: "Thank you! That was the part we iterated on most.", createdAt: "2026-07-12T07:02:00Z", reactions: reaction([], false) }] }] },
];
const delay = () => new Promise((resolve) => setTimeout(resolve, 140));
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const findPost = (postId: string) => posts.find((post) => post.id === postId);

export const mockFeedRepository: FeedRepository = {
  async list(viewerId) { await delay(); return ok({ items: visibleTo(posts, viewerId), nextCursor: null }); },
  async create(input: CreatePostInput) { await delay(); const post: Post = { id: id("post"), author: currentUser, ...input, createdAt: new Date().toISOString(), reactions: reaction(), comments: [] }; posts = newestFirst([post, ...posts]); return ok(post); },
  async togglePostLike(postId) { const post = findPost(postId); if (!post) return fail("NOT_FOUND", "Post not found."); posts = posts.map((item) => item.id === postId ? { ...item, reactions: toggleReaction(item.reactions, currentUser) } : item); return ok(findPost(postId)!); },
  async addComment(postId, body) { const post = findPost(postId); if (!post) return fail("NOT_FOUND", "Post not found."); const comment: Comment = { id: id("comment"), author: currentUser, body, createdAt: new Date().toISOString(), reactions: reaction(), replies: [] }; posts = posts.map((item) => item.id === postId ? { ...item, comments: [...item.comments, comment] } : item); return ok(comment); },
  async toggleCommentLike(postId, commentId) { const post = findPost(postId), comment = post?.comments.find((item) => item.id === commentId); if (!comment) return fail("NOT_FOUND", "Comment not found."); posts = updateComment(posts, postId, commentId, (item) => ({ ...item, reactions: toggleReaction(item.reactions, currentUser) })); return ok(findPost(postId)!.comments.find((item) => item.id === commentId)!); },
  async addReply(postId, commentId, body) { const post = findPost(postId), comment = post?.comments.find((item) => item.id === commentId); if (!comment) return fail("NOT_FOUND", "Comment not found."); const reply: Reply = { id: id("reply"), author: currentUser, body, createdAt: new Date().toISOString(), reactions: reaction(), }; posts = updateComment(posts, postId, commentId, (item) => ({ ...item, replies: [...item.replies, reply] })); return ok(reply); },
  async toggleReplyLike(postId, commentId, replyId) { const reply = findPost(postId)?.comments.find((item) => item.id === commentId)?.replies.find((item) => item.id === replyId); if (!reply) return fail("NOT_FOUND", "Reply not found."); posts = updateReply(posts, postId, commentId, replyId, (item) => ({ ...item, reactions: toggleReaction(item.reactions, currentUser) })); return ok(findPost(postId)!.comments.find((item) => item.id === commentId)!.replies.find((item) => item.id === replyId)!); },
};
