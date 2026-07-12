import { z } from "zod";

export const createPostSchema = z.object({
  body: z.string().trim().min(1).max(5_000).optional(),
  visibility: z.enum(["public", "private"]),
  image: z.object({
    publicId: z.string().min(1).max(255), secureUrl: z.url().max(2_048), version: z.number().int().positive(),
    width: z.number().int().positive(), height: z.number().int().positive(), bytes: z.number().int().positive(),
    format: z.string().min(1).max(20), signature: z.string().min(1).max(255),
  }).strict().optional(),
}).strict().refine(({ body, image }) => body !== undefined || image !== undefined, { message: "Post text or image is required", path: ["body"] });

export const postParamsSchema = z.object({ postId: z.uuid() }).strict();
export const pageQuerySchema = z.object({
  cursor: z.string().min(10).max(2_048).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
}).strict();

export type CreatePostRequest = z.infer<typeof createPostSchema>;
export type PageQuery = z.infer<typeof pageQuerySchema>;
