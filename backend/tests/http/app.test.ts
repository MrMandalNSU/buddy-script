import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "../helpers/test-app.js";

interface ResponseBody {
  meta: { requestId: string };
  openapi?: string;
  paths?: Record<string, unknown>;
}

describe("HTTP foundation", () => {
  it("returns a normalized liveness response and request ID", async () => {
    const response = await request(createTestApp()).get("/health/live").set("x-request-id", "test-request-123");
    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe("test-request-123");
    expect(response.body).toMatchObject({ success: true, data: { status: "alive" }, meta: { requestId: "test-request-123" } });
  });

  it("reports readiness state", async () => {
    const response = await request(createTestApp(false)).get("/health/ready");
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ success: true, data: { status: "not_ready" } });
  });

  it("normalizes missing routes without exposing internals", async () => {
    const response = await request(createTestApp()).get("/missing");
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, error: { code: "NOT_FOUND" } });
    const body = response.body as ResponseBody;
    expect(body.meta.requestId).toEqual(expect.any(String));
  });

  it("rejects unapproved cross-origin callers", async () => {
    const response = await request(createTestApp()).get("/health/live").set("origin", "https://evil.example");
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ success: false, error: { code: "FORBIDDEN" } });
  });

  it("serves the OpenAPI foundation", async () => {
    const response = await request(createTestApp()).get("/docs/openapi.json");
    expect(response.status).toBe(200);
    const body = response.body as ResponseBody;
    expect(body.openapi).toBe("3.1.0");
    expect(body.paths?.["/health/live"]).toBeDefined();
    expect(body.paths?.["/comments/{commentId}/replies"]).toBeDefined();
  });

  it("exposes Prometheus metrics separately from the versioned API", async () => {
    const response = await request(createTestApp()).get("/metrics");
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toContain("buddyscript_http_request_duration_seconds");
  });
});
