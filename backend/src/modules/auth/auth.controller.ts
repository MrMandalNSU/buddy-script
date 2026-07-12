import type { Request, Response } from "express";
import type { LoginInput, RegisterInput } from "./auth.types.js";
import type { AuthCookieService } from "./cookie.service.js";
import type { AuthService } from "./auth.service.js";
import { successEnvelope } from "../../shared/http/envelope.js";
import { AppError } from "../../shared/errors/app-error.js";

export class AuthController {
  constructor(readonly service: AuthService, readonly cookies: AuthCookieService) {}

  register = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.register(request.body as RegisterInput, clientMetadata(request));
    this.cookies.set(response, result.tokens);
    response.status(201).json(successEnvelope(authPayload(result), request.requestId));
  };

  login = async (request: Request, response: Response): Promise<void> => {
    const result = await this.service.login(request.body as LoginInput, clientMetadata(request));
    this.cookies.set(response, result.tokens);
    response.json(successEnvelope(authPayload(result), request.requestId));
  };

  refresh = async (request: Request, response: Response): Promise<void> => {
    if (request.refreshAuth === undefined) throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
    const result = await this.service.refresh(request.refreshAuth.rawToken, clientMetadata(request));
    this.cookies.set(response, result.tokens);
    response.json(successEnvelope(authPayload(result), request.requestId));
  };

  logout = async (request: Request, response: Response): Promise<void> => {
    if (request.refreshAuth !== undefined) await this.service.logout(request.refreshAuth.rawToken);
    this.cookies.clear(response); response.status(204).send();
  };

  logoutAll = async (request: Request, response: Response): Promise<void> => {
    if (request.auth === undefined) throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
    await this.service.logoutAll(request.auth.userId); this.cookies.clear(response); response.status(204).send();
  };

  me = async (request: Request, response: Response): Promise<void> => {
    if (request.auth === undefined) throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
    response.json(successEnvelope({ user: await this.service.currentUser(request.auth.userId) }, request.requestId));
  };
}

function clientMetadata(request: Request) {
  const userAgent = request.header("user-agent");
  return { ...(request.ip === undefined ? {} : { ipAddress: request.ip }), ...(userAgent === undefined ? {} : { userAgent }) };
}
function authPayload(result: Awaited<ReturnType<AuthService["login"]>>) {
  return { user: result.user, session: { accessExpiresAt: result.tokens.accessExpiresAt.toISOString() } };
}
