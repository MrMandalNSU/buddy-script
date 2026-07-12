import { describe, expect, it } from "vitest";
import { validateLogin, validateRegistration } from "./validation";

describe("auth validation", () => {
  it("rejects invalid login values", () => {
    expect(validateLogin({ email: "bad", password: "", remember: false })).toEqual({
      email: "Enter a valid email address.", password: "Password is required.",
    });
  });
  it("accepts a complete registration", () => {
    expect(validateRegistration({ firstName: "Ava", lastName: "Stone", email: "ava@example.com", password: "password1", confirmPassword: "password1", acceptedTerms: true })).toEqual({});
  });
});
