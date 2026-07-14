"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../AuthProvider";
import type { LoginInput, RegisterInput } from "../types";
import { evaluatePasswordRequirements, validateLogin, validateRegistration, type FieldErrors, type PasswordRequirements } from "../validation";

type AuthKind = "login" | "register";
type PasswordFieldName = "password" | "confirmPassword";

const initialLogin: LoginInput = { email: "", password: "", remember: true };
const initialRegister: RegisterInput = { firstName: "", lastName: "", email: "", password: "", confirmPassword: "", acceptedTerms: false };
const passwordRequirementLabels: Array<{ key: keyof PasswordRequirements; label: string }> = [
  { key: "uppercase", label: "Uppercase" },
  { key: "specialCharacter", label: "Special character" },
  { key: "minLength", label: "8+ characters" },
];

export function AuthForm({ kind }: { kind: AuthKind }) {
  const router = useRouter();
  const auth = useAuth();
  const [values, setValues] = useState<LoginInput | RegisterInput>(kind === "login" ? initialLogin : initialRegister);
  const [errors, setErrors] = useState<FieldErrors<LoginInput & RegisterInput>>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [passwordVisibility, setPasswordVisibility] = useState<Record<PasswordFieldName, boolean>>({ password: false, confirmPassword: false });
  const register = values as RegisterInput;
  const login = values as LoginInput;
  const passwordRequirements = evaluatePasswordRequirements(register.password);
  const passwordsMatch = Boolean(register.confirmPassword) && register.confirmPassword === register.password;

  const update = (name: string, value: string | boolean) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({
      ...current,
      [name]: undefined,
      ...(["password", "confirmPassword"].includes(name) ? { confirmPassword: undefined } : {}),
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setMessage("");
    const nextErrors = kind === "login" ? validateLogin(values as LoginInput) : validateRegistration(values as RegisterInput);
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    setPending(true);
    const result = kind === "login" ? await auth.login(values as LoginInput) : await auth.register(values as RegisterInput);
    setPending(false);
    if (!result.ok) { setErrors(result.error.fieldErrors ?? {}); setMessage(result.error.message); return; }
    router.replace("/feed"); router.refresh();
  };

  const input = (name: keyof RegisterInput, label: string, type = "text", autoComplete?: string) => <div className="field">
    <label htmlFor={name}>{label}</label>
    <input id={name} name={name} type={type} autoComplete={autoComplete} value={String((values as unknown as Record<string, unknown>)[name] ?? "")} onChange={(event) => update(name, event.target.value)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} />
    {errors[name] && <span className="field-error" id={`${name}-error`}>{errors[name]}</span>}
  </div>;

  const passwordInput = (name: PasswordFieldName, label: string, autoComplete: string, descriptionId?: string, matched = false) => {
    const visible = passwordVisibility[name];
    const describedBy = [descriptionId, errors[name] ? `${name}-error` : undefined].filter(Boolean).join(" ") || undefined;
    const visibilityLabel = `${visible ? "Hide" : "Show"} ${name === "confirmPassword" ? "repeat password" : "password"}`;
    return <div className="field">
      <label htmlFor={name}>{label}</label>
      <div className={`password-control${matched ? " has-match" : ""}`}>
        <input id={name} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} value={String((values as unknown as Record<string, unknown>)[name] ?? "")} onChange={(event) => update(name, event.target.value)} aria-invalid={Boolean(errors[name])} aria-describedby={describedBy} />
        {matched && <span className="password-match" id="confirmPassword-match" role="status"><CheckIcon /><span className="sr-only">Passwords match.</span></span>}
        <button className="password-visibility" type="button" aria-label={visibilityLabel} aria-pressed={visible} onClick={() => setPasswordVisibility((current) => ({ ...current, [name]: !current[name] }))}>
          <EyeIcon hidden={visible} />
        </button>
      </div>
      {errors[name] && <span className="field-error" id={`${name}-error`}>{errors[name]}</span>}
    </div>;
  };

  return <>
    <Image className="auth-logo" src="/assets/logo.svg" alt="BuddyScript" width={185} height={46} priority />
    <p className="auth-eyebrow">{kind === "login" ? "Welcome back" : "Get Started Now"}</p>
    <h1>{kind === "login" ? "Login to your account" : "Registration"}</h1>
    <button className="google-button" type="button" disabled aria-label="Google authentication is not available in this demo"><Image src="/assets/google.svg" alt="" width={20} height={20} />{kind === "login" ? "Or sign-in with google" : "Register with google"}</button>
    <div className="or-divider"><span>Or</span></div>
    <form className="auth-form" onSubmit={submit} noValidate>
      {kind === "register" && <div className="name-fields">{input("firstName", "First name", "text", "given-name")}{input("lastName", "Last name", "text", "family-name")}</div>}
      {input("email", "Email", "email", "email")}
      {passwordInput("password", "Password", kind === "login" ? "current-password" : "new-password", kind === "register" ? "password-requirements" : undefined)}
      {kind === "register" && <ul className="password-requirements" id="password-requirements" aria-label="Password requirements" aria-live="polite">
        {passwordRequirementLabels.map(({ key, label }) => <li className={passwordRequirements[key] ? "is-met" : ""} data-requirement={key} key={key}>
          <CheckIcon /><span><span className="sr-only">{passwordRequirements[key] ? "Met: " : "Not met: "}</span>{label}</span>
        </li>)}
      </ul>}
      {kind === "register" && passwordInput("confirmPassword", "Repeat Password", "new-password", passwordsMatch ? "confirmPassword-match" : undefined, passwordsMatch)}
      <div className="form-options">
        <label className="check"><input type="checkbox" checked={kind === "login" ? login.remember : register.acceptedTerms} onChange={(event) => update(kind === "login" ? "remember" : "acceptedTerms", event.target.checked)} /><span>{kind === "login" ? "Remember me" : "I agree to terms & conditions"}</span></label>
        {kind === "login" && <button className="text-button" type="button" disabled>Forgot password?</button>}
      </div>
      {errors.acceptedTerms && <span className="field-error">{errors.acceptedTerms}</span>}
      {message && <div className="form-alert" role="alert">{message}</div>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "Please wait..." : kind === "login" ? "Login now" : "Create account"}</button>
    </form>
    <p className="auth-switch">{kind === "login" ? "Don't have an account?" : "Already have an account?"} <Link href={kind === "login" ? "/register" : "/login"}>{kind === "login" ? "Create New Account" : "Login now"}</Link></p>
  </>;
}

function CheckIcon() {
  return <svg className="check-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" /><path d="m6 10 2.5 2.5L14 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.73 5.08A10.7 10.7 0 0 1 12 5c7 0 10 7 10 7a13.2 13.2 0 0 1-1.67 2.68" /><path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" /><path d="M17.48 17.5A10.8 10.8 0 0 1 12 19C5 19 2 12 2 12a13.2 13.2 0 0 1 3.84-4.61" /><path d="m2 2 20 20" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}
