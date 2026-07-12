import type { CookieOptions, Request, Response } from "express";
import type { Environment } from "../../config/env.js";
import type { AuthTokens } from "./auth.types.js";

export interface AuthCookieNames { access: string; refresh: string; csrf: string }

export function authCookieNames(secure: boolean): AuthCookieNames {
  return secure
    ? { access: "__Host-bs_access", refresh: "__Secure-bs_refresh", csrf: "__Host-bs_csrf" }
    : { access: "bs_access", refresh: "bs_refresh", csrf: "bs_csrf" };
}

export class AuthCookieService {
  readonly names: AuthCookieNames;
  readonly #base: CookieOptions;

  constructor(readonly environment: Environment) {
    this.names = authCookieNames(environment.cookieSecure);
    this.#base = { secure: environment.cookieSecure, sameSite: "strict" };
  }

  set(response: Response, tokens: AuthTokens): void {
    response.cookie(this.names.access, tokens.accessToken, { ...this.#base, httpOnly: true, path: "/", expires: tokens.accessExpiresAt });
    response.cookie(this.names.refresh, tokens.refreshToken, { ...this.#base, httpOnly: true, path: "/api/v1/auth", expires: tokens.refreshExpiresAt });
    response.cookie(this.names.csrf, tokens.csrfToken, { ...this.#base, httpOnly: false, path: "/", expires: tokens.refreshExpiresAt });
  }

  clear(response: Response): void {
    response.clearCookie(this.names.access, { ...this.#base, httpOnly: true, path: "/" });
    response.clearCookie(this.names.refresh, { ...this.#base, httpOnly: true, path: "/api/v1/auth" });
    response.clearCookie(this.names.csrf, { ...this.#base, httpOnly: false, path: "/" });
  }

  accessToken(request: Request): string | undefined { return this.read(request, this.names.access); }
  refreshToken(request: Request): string | undefined { return this.read(request, this.names.refresh); }
  csrfToken(request: Request): string | undefined { return this.read(request, this.names.csrf); }

  private read(request: Request, name: string): string | undefined {
    const cookies: unknown = request.cookies;
    if (typeof cookies !== "object" || cookies === null) return undefined;
    const value = (cookies as Record<string, unknown>)[name];
    return typeof value === "string" ? value : undefined;
  }
}
