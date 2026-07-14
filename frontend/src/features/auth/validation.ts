import type { LoginInput, RegisterInput } from "./types";

export type FieldErrors<T> = Partial<Record<keyof T, string>>;
export type PasswordRequirements = {
  minLength: boolean;
  uppercase: boolean;
  specialCharacter: boolean;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uppercasePattern = /\p{Lu}/u;
const specialCharacterPattern = /[\p{P}\p{S}]/u;

export function evaluatePasswordRequirements(password: string): PasswordRequirements {
  return {
    minLength: password.length >= 8,
    uppercase: uppercasePattern.test(password),
    specialCharacter: specialCharacterPattern.test(password),
  };
}

export function validateLogin(input: LoginInput): FieldErrors<LoginInput> {
  const errors: FieldErrors<LoginInput> = {};
  if (!emailPattern.test(input.email.trim())) errors.email = "Enter a valid email address.";
  if (!input.password) errors.password = "Password is required.";
  return errors;
}

export function validateRegistration(input: RegisterInput): FieldErrors<RegisterInput> {
  const errors: FieldErrors<RegisterInput> = {};
  if (input.firstName.trim().length < 2) errors.firstName = "First name must be at least 2 characters.";
  if (input.lastName.trim().length < 2) errors.lastName = "Last name must be at least 2 characters.";
  if (!emailPattern.test(input.email.trim())) errors.email = "Enter a valid email address.";
  const passwordRequirements = evaluatePasswordRequirements(input.password);
  if (Object.values(passwordRequirements).some((requirement) => !requirement)) errors.password = "Password must meet all requirements.";
  if (input.confirmPassword !== input.password) errors.confirmPassword = "Passwords do not match.";
  if (!input.acceptedTerms) errors.acceptedTerms = "You must accept the terms and conditions.";
  return errors;
}
