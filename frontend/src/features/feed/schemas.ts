import { z } from "zod";
import { apiUserSchema } from "@/shared/api/schemas";
export const feedUserSchema = apiUserSchema.pick({ id: true, firstName: true, lastName: true, avatarUrl: true });
export const imageSchema = z.object({ publicId: z.string(), secureUrl: z.string(), version: z.number(), width: z.number(), height: z.number(), bytes: z.number(), format: z.string() });
export const commentSchema = z.object({ id: z.string(), postId: z.string(), parentId: z.string().nullable(), depth: z.union([z.literal(0), z.literal(1)]), body: z.string(), author: feedUserSchema, engagement: z.object({ likeCount: z.number(), replyCount: z.number(), likedByViewer: z.boolean() }), createdAt: z.string(), updatedAt: z.string() });
export const postSchema = z.object({ id: z.string(), body: z.string().nullable(), visibility: z.enum(["public", "private"]), image: imageSchema.nullable(), author: feedUserSchema, engagement: z.object({ likeCount: z.number(), commentCount: z.number(), likedByViewer: z.boolean() }), commentPreview: z.array(commentSchema), createdAt: z.string(), updatedAt: z.string() });
export const pageSchema = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item), nextCursor: z.string().nullable() });
export const reactionSchema = z.object({ liked: z.boolean(), likeCount: z.number() });
export const likerSchema = feedUserSchema.extend({ likedAt: z.string() });
