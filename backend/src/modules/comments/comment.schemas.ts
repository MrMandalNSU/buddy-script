import { z } from "zod";
import { reactionValues } from "../posts/reaction.dto.js";

export const commentBodySchema = z.object({ body: z.string().trim().min(1).max(2_000) }).strict();
export const commentParamsSchema = z.object({ commentId: z.uuid() }).strict();
export const postCommentParamsSchema = z.object({ postId: z.uuid() }).strict();
export const commentReactionBodySchema = z.object({ reaction: z.enum(reactionValues) }).strict();
export type CommentBodyRequest = z.infer<typeof commentBodySchema>;
export type CommentReactionBodyRequest = z.infer<typeof commentReactionBodySchema>;
