import { z } from "zod";

export const commentBodySchema = z.object({ body: z.string().trim().min(1).max(2_000) }).strict();
export const commentParamsSchema = z.object({ commentId: z.uuid() }).strict();
export const postCommentParamsSchema = z.object({ postId: z.uuid() }).strict();
export type CommentBodyRequest = z.infer<typeof commentBodySchema>;
