import { describe, expect, it } from "vitest";
import { isPooledNeonUrl, requireDatabaseUrl } from "../../src/infrastructure/database/database-url.js";

describe("database URL safeguards", () => {
  it("recognizes Neon pooler hosts", () => {
    expect(isPooledNeonUrl("postgresql://user:pass@ep-example-pooler.us-east-1.aws.neon.tech/db")).toBe(true);
    expect(isPooledNeonUrl("postgresql://user:pass@ep-example.us-east-1.aws.neon.tech/db")).toBe(false);
  });

  it("fails fast when runtime configuration is absent", () => {
    expect(() => requireDatabaseUrl(undefined)).toThrow("Database configuration is missing");
  });
});
