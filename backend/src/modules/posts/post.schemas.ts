import { z } from "zod";
import { reactionValues } from "./reaction.dto.js";

const postImageSchema = z.object({
  publicId: z.string().min(1).max(255), secureUrl: z.url().max(2_048), version: z.number().int().positive(),
  width: z.number().int().positive(), height: z.number().int().positive(), bytes: z.number().int().positive(),
  format: z.string().min(1).max(20), signature: z.string().min(1).max(255),
}).strict();

export const createPostSchema = z.object({
  body: z.string().trim().min(1).max(5_000).optional(),
  visibility: z.enum(["public", "private"]),
  image: postImageSchema.optional(),
}).strict().refine(({ body, image }) => body !== undefined || image !== undefined, { message: "Post text or image is required", path: ["body"] });

export const updatePostSchema = z.object({
  body: z.string().trim().min(1).max(5_000).nullable().optional(),
  visibility: z.enum(["public", "private"]).optional(),
  image: postImageSchema.nullable().optional(),
}).strict().refine(({ body, visibility, image }) => body !== undefined || visibility !== undefined || image !== undefined, {
  message: "At least one post field is required",
});

export const postParamsSchema = z.object({ postId: z.uuid() }).strict();
export const reactionBodySchema = z.object({ reaction: z.enum(reactionValues) }).strict();
export const pageQuerySchema = z.object({
  cursor: z.string().min(10).max(2_048).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
}).strict();

export type CreatePostRequest = z.infer<typeof createPostSchema>;
export type UpdatePostRequest = z.infer<typeof updatePostSchema>;
export type PageQuery = z.infer<typeof pageQuerySchema>;
export type ReactionBodyRequest = z.infer<typeof reactionBodySchema>;
