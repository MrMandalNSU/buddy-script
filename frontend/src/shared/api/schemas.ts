import { z } from "zod";
export const apiUserSchema = z.object({ id: z.string(), firstName: z.string(), lastName: z.string(), email: z.string().optional(), avatarUrl: z.string().nullable(), createdAt: z.string().optional() });
export const metaSchema = z.object({ requestId: z.string(), timestamp: z.string() });
export const errorEnvelopeSchema = z.object({ success: z.literal(false), error: z.object({ code: z.string(), message: z.string(), details: z.record(z.string(), z.unknown()).optional() }), meta: metaSchema });
export const successEnvelope = <T extends z.ZodType>(data: T) => z.object({ success: z.literal(true), data, meta: metaSchema });
