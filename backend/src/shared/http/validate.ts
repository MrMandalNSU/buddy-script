import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError } from "../errors/app-error.js";

export function validateBody(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    if (!request.is("application/json")) return next(new AppError(415, "BAD_REQUEST", "Content-Type must be application/json"));
    request.body = schema.parse(request.body);
    next();
  };
}

export function validateParams(schema: ZodType): RequestHandler {
  return (request, _response, next) => { request.params = schema.parse(request.params) as Record<string, string>; next(); };
}

export function validateQuery(schema: ZodType): RequestHandler {
  return (request, _response, next) => {
    const parsed = schema.parse(request.query) as Record<string, unknown>;
    Object.defineProperty(request, "query", { value: parsed, configurable: true, enumerable: true, writable: true });
    next();
  };
}
