import { describe, expect, it } from "vitest";
import { loginSchema, registerSchema } from "./auth.schemas.js";

const registration = (password: string) => ({
  firstName: "Ava",
  lastName: "Stone",
  email: "ava@example.com",
  password,
});

describe("authentication schemas", () => {
  it.each([
    ["minimum length", "Pass!", "Password must contain at least 8 characters"],
    ["uppercase letter", "password!", "Password must contain at least one uppercase letter"],
    ["special character", "Password", "Password must contain at least one special character"],
    ["non-whitespace special character", "Password ", "Password must contain at least one special character"],
  ])("rejects a registration password missing the %s requirement", (_requirement, password, message) => {
    const result = registerSchema.safeParse(registration(password));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path: ["password"], message })]));
  });

  it("accepts a registration password that meets every requirement", () => {
    expect(registerSchema.safeParse(registration("Password!")).success).toBe(true);
  });

  it("does not apply the registration policy to login passwords", () => {
    expect(loginSchema.safeParse({ email: "ava@example.com", password: "historical-password" }).success).toBe(true);
  });
});
