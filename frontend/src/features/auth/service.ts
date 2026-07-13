import { z } from "zod";
import { apiRequest, ApiError } from "@/shared/api/client";
import { apiUserSchema } from "@/shared/api/schemas";
import type { Result } from "@/shared/result";
import type { LoginInput, RegisterInput, Session, User } from "./types";

const authSchema = z.object({ user: apiUserSchema, session: z.object({ accessExpiresAt: z.string() }) });
const meSchema = z.object({ user: apiUserSchema });
const user = (value: z.infer<typeof apiUserSchema>): User => ({ id: value.id, firstName: value.firstName, lastName: value.lastName, email: value.email ?? "", avatarUrl: value.avatarUrl, ...(value.createdAt === undefined ? {} : { createdAt: value.createdAt }) });
const normalized = (error: unknown): Result<never> => ({ ok: false, error: { code: error instanceof ApiError && error.status === 401 ? "UNAUTHORIZED" : error instanceof ApiError && error.status === 422 ? "VALIDATION" : "UNKNOWN", message: error instanceof Error ? error.message : "We could not reach BuddyScript. Please try again." } });

export const authService = {
  async login(input: LoginInput): Promise<Result<Session>> { try { const data = await apiRequest<z.infer<typeof authSchema>>("/api/v1/auth/login", { method: "POST", body: { email: input.email.trim(), password: input.password }, schema: authSchema, authRetry: false }); return { ok: true, data: { user: user(data.user), accessExpiresAt: data.session.accessExpiresAt } }; } catch (error) { return normalized(error); } },
  async register(input: RegisterInput): Promise<Result<Session>> { try { const data = await apiRequest<z.infer<typeof authSchema>>("/api/v1/auth/register", { method: "POST", body: { firstName: input.firstName.trim(), lastName: input.lastName.trim(), email: input.email.trim(), password: input.password }, schema: authSchema, authRetry: false }); return { ok: true, data: { user: user(data.user), accessExpiresAt: data.session.accessExpiresAt } }; } catch (error) { return normalized(error); } },
  async me(): Promise<User> { const data = await apiRequest<z.infer<typeof meSchema>>("/api/v1/auth/me", { schema: meSchema }); return user(data.user); },
  async logout(): Promise<void> { try { await apiRequest<void>("/api/v1/auth/logout", { method: "POST", authRetry: false }); } catch (error) { if (!(error instanceof ApiError && error.status === 401)) throw error; } },
};
