import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import type { AuthCookieService } from "./cookie.service.js";
import type { TokenService } from "./token.service.js";

export function authenticateAccess(tokens: TokenService, cookies: AuthCookieService): RequestHandler {
  return async (request, _response, next) => {
    const rawToken = cookies.accessToken(request);
    if (rawToken === undefined) return next(unauthorized());
    try { request.auth = await tokens.verifyAccess(rawToken); next(); }
    catch { next(unauthorized()); }
  };
}

export function authenticateRefresh(tokens: TokenService, cookies: AuthCookieService): RequestHandler {
  return async (request, _response, next) => {
    const rawToken = cookies.refreshToken(request);
    if (rawToken === undefined) return next(unauthorized());
    try { request.refreshAuth = { ...(await tokens.verifyRefresh(rawToken)), rawToken }; next(); }
    catch { next(unauthorized()); }
  };
}

export function requireAccessCsrf(cookies: AuthCookieService): RequestHandler {
  return (request, _response, next) => csrfMatches(request.header("x-csrf-token"), cookies.csrfToken(request), request.auth?.csrfToken) ? next() : next(csrfError());
}

export function requireRefreshCsrf(cookies: AuthCookieService): RequestHandler {
  return (request, _response, next) => csrfMatches(request.header("x-csrf-token"), cookies.csrfToken(request), request.refreshAuth?.csrfToken) ? next() : next(csrfError());
}

function csrfMatches(header: string | undefined, cookie: string | undefined, claim: string | undefined): boolean {
  if (header === undefined || cookie === undefined || claim === undefined) return false;
  const left = Buffer.from(header); const middle = Buffer.from(cookie); const right = Buffer.from(claim);
  return left.length === middle.length && middle.length === right.length && timingSafeEqual(left, middle) && timingSafeEqual(middle, right);
}

function unauthorized(): AppError { return new AppError(401, "UNAUTHORIZED", "Authentication is required"); }
function csrfError(): AppError { return new AppError(403, "FORBIDDEN", "CSRF validation failed"); }
