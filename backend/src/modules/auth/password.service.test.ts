import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.service.js";

describe("password service", () => {
  it("hashes with Argon2id and verifies without exposing the password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong password")).resolves.toBe(false);
  });

  it("performs a safe dummy verification for missing users", async () => {
    await expect(verifyPassword(undefined, "unknown password")).resolves.toBe(false);
  });
});
