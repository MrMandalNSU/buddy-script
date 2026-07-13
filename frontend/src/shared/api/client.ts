import { z } from "zod";
import { errorEnvelopeSchema, successEnvelope } from "./schemas";
export class ApiError extends Error { constructor(readonly status: number, readonly code: string, message: string, readonly details?: Record<string, unknown>) { super(message); this.name = "ApiError"; } }
type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown; schema?: z.ZodType; authRetry?: boolean; timeoutMs?: number };
let refreshPromise: Promise<boolean> | undefined;
export function csrfToken(source = typeof document === "undefined" ? "" : document.cookie): string | undefined {
  for (const name of ["__Host-bs_csrf", "bs_csrf"]) { const entry = source.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`)); if (entry !== undefined) return decodeURIComponent(entry.slice(name.length + 1)); }
  return undefined;
}
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await rawRequest(path, options);
  const noRefresh = ["/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh", "/api/v1/auth/logout"];
  if (response.status === 401 && options.authRetry !== false && !noRefresh.includes(path)) { if (await refreshSession()) return apiRequest<T>(path, { ...options, authRetry: false }); }
  if (response.status === 204) return undefined as T;
  const json: unknown = await response.json().catch(() => undefined);
  if (!response.ok) { const parsed = errorEnvelopeSchema.safeParse(json); throw parsed.success ? new ApiError(response.status, parsed.data.error.code, parsed.data.error.message, parsed.data.error.details) : new ApiError(response.status, "UNKNOWN", "BuddyScript returned an unexpected response."); }
  const parsed = successEnvelope(options.schema ?? z.unknown()).safeParse(json); if (!parsed.success) throw new ApiError(502, "INVALID_RESPONSE", "BuddyScript returned an invalid response."); return parsed.data.data as T;
}
async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
  if (!path.startsWith("/api/v1/")) throw new Error("API paths must be same-origin and versioned");
  const { body, timeoutMs = 15_000, headers, ...init } = options; delete init.schema; delete init.authRetry; const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const mutation = init.method !== undefined && !["GET", "HEAD"].includes(init.method.toUpperCase()); const csrf = mutation ? csrfToken() : undefined;
  const signal = options.signal == null ? controller.signal : AbortSignal.any([options.signal, controller.signal]);
  try { return await fetch(path, { ...init, credentials: "same-origin", signal, headers: { "X-Request-Id": crypto.randomUUID(), ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(csrf === undefined ? {} : { "X-CSRF-Token": csrf }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
  finally { clearTimeout(timeout); }
}
async function refreshSession(): Promise<boolean> {
  refreshPromise ??= (async () => { try { return (await rawRequest("/api/v1/auth/refresh", { method: "POST", authRetry: false })).ok; } catch { return false; } finally { refreshPromise = undefined; } })(); return refreshPromise;
}
