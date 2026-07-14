import { describe, expect, it } from "vitest";
import type { RegisterInput } from "./types";
import { evaluatePasswordRequirements, validateLogin, validateRegistration } from "./validation";

const registration = (password: string, confirmPassword = password): RegisterInput => ({
  firstName: "Ava",
  lastName: "Stone",
  email: "ava@example.com",
  password,
  confirmPassword,
  acceptedTerms: true,
});

describe("auth validation", () => {
  it("rejects invalid login values without applying registration rules", () => {
    expect(validateLogin({ email: "bad", password: "", remember: false })).toEqual({
      email: "Enter a valid email address.", password: "Password is required.",
    });
    expect(validateLogin({ email: "ava@example.com", password: "historical-password", remember: false })).toEqual({});
  });

  it("evaluates each registration password requirement independently", () => {
    expect(evaluatePasswordRequirements("short")).toEqual({ minLength: false, uppercase: false, specialCharacter: false });
    expect(evaluatePasswordRequirements("long enough")).toEqual({ minLength: true, uppercase: false, specialCharacter: false });
    expect(evaluatePasswordRequirements("Long enough")).toEqual({ minLength: true, uppercase: true, specialCharacter: false });
    expect(evaluatePasswordRequirements("Password!")).toEqual({ minLength: true, uppercase: true, specialCharacter: true });
  });

  it.each([
    ["minimum length", "Pass!"],
    ["uppercase letter", "password!"],
    ["special character", "Password"],
    ["non-whitespace special character", "Password "],
  ])("rejects a registration password missing the %s requirement", (_requirement, password) => {
    expect(validateRegistration(registration(password))).toMatchObject({ password: "Password must meet all requirements." });
  });

  it("rejects a mismatched repeat password", () => {
    expect(validateRegistration(registration("Password!", "Password?"))).toMatchObject({ confirmPassword: "Passwords do not match." });
  });

  it("accepts a complete registration", () => {
    expect(validateRegistration(registration("Password!"))).toEqual({});
  });
});
