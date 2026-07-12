import { describe, expect, it } from "vitest";
import { EnvironmentValidationError, loadEnvironment } from "../../src/config/env.js";

describe("loadEnvironment", () => {
  it("applies safe development defaults", () => {
    const environment = loadEnvironment({});
    expect(environment.port).toBe(4000);
    expect(environment.trustProxy).toBe(false);
    expect(environment.allowedOrigins.has("http://localhost:3000")).toBe(true);
  });

  it("parses comma-separated origins", () => {
    const environment = loadEnvironment({ ALLOWED_ORIGINS: "https://app.example.com, https://admin.example.com" });
    expect([...environment.allowedOrigins]).toEqual(["https://app.example.com", "https://admin.example.com"]);
  });

  it("rejects invalid values without printing their source", () => {
    expect(() => loadEnvironment({ PORT: "99999" })).toThrow(EnvironmentValidationError);
  });

  it("supports the legacy development database key without exposing it", () => {
    const environment = loadEnvironment({ DATABASE_URL_DEV: "postgresql://user:secret@localhost:5432/buddy" });
    expect(environment.databaseUrl).toBe("postgresql://user:secret@localhost:5432/buddy");
    expect(environment.directUrl).toBe(environment.databaseUrl);
  });

  it("prefers dedicated pooled and direct URLs", () => {
    const environment = loadEnvironment({
      DATABASE_URL: "postgresql://user:secret@pooler.local/buddy",
      DIRECT_URL: "postgresql://user:secret@direct.local/buddy",
    });
    expect(environment.databaseUrl).toContain("pooler.local");
    expect(environment.directUrl).toContain("direct.local");
  });
});
