import type { Result } from "@/shared/result";
import type { LoginInput, RegisterInput, Session } from "./types";

export interface AuthService {
  login(input: LoginInput): Promise<Result<Session>>;
  register(input: RegisterInput): Promise<Result<Session>>;
  logout(): Promise<Result<void>>;
}

async function request(path: string, body?: unknown): Promise<Result<Session | void>> {
  try {
    const response = await fetch(path, {
      method: body ? "POST" : "DELETE",
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return await response.json();
  } catch {
    return { ok: false, error: { code: "UNKNOWN", message: "We could not reach BuddyScript. Please try again." } };
  }
}

export const authService: AuthService = {
  login: (input) => request("/api/auth/login", input) as Promise<Result<Session>>,
  register: (input) => request("/api/auth/register", input) as Promise<Result<Session>>,
  logout: () => request("/api/auth/logout") as Promise<Result<void>>,
};
