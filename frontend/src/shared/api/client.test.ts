import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, csrfToken } from "./client";
import { z } from "zod";

const response = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const success = (data: unknown) => ({ success: true, data, meta: { requestId: "request-1", timestamp: new Date().toISOString() } });
const failure = (code: string, message: string) => ({ success: false, error: { code, message }, meta: { requestId: "request-1", timestamp: new Date().toISOString() } });

describe("API client", () => {
  afterEach(() => vi.restoreAllMocks());
  it("selects production and development CSRF cookies", () => { expect(csrfToken("other=x; bs_csrf=dev-token")).toBe("dev-token"); expect(csrfToken("bs_csrf=dev; __Host-bs_csrf=prod-token")).toBe("prod-token"); });
  it("validates success envelopes and normalizes errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(success({ value: 4 }))));
    await expect(apiRequest<{ value: number }>("/api/v1/test", { schema: z.object({ value: z.number() }) })).resolves.toEqual({ value: 4 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(failure("BAD_REQUEST", "Nope"), 400)));
    await expect(apiRequest("/api/v1/test", { authRetry: false })).rejects.toEqual(expect.objectContaining({ status: 400, code: "BAD_REQUEST", message: "Nope", name: "ApiError" }));
  });
  it("coalesces concurrent refreshes and retries each request once", async () => {
    let refreshes = 0; let protectedCalls = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => { const path = String(input); if (path.endsWith("/auth/refresh")) { refreshes += 1; await Promise.resolve(); return response(success({})); } protectedCalls += 1; return protectedCalls <= 2 ? response(failure("UNAUTHORIZED", "Expired"), 401) : response(success({ ok: true })); }));
    await Promise.all([apiRequest("/api/v1/posts"), apiRequest("/api/v1/posts")]);
    expect(refreshes).toBe(1); expect(protectedCalls).toBe(4);
  });
});
