"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../AuthProvider";
import type { LoginInput, RegisterInput } from "../types";
import { validateLogin, validateRegistration, type FieldErrors } from "../validation";

type AuthKind = "login" | "register";
const initialLogin: LoginInput = { email: "", password: "", remember: true };
const initialRegister: RegisterInput = { firstName: "", lastName: "", email: "", password: "", confirmPassword: "", acceptedTerms: false };

export function AuthForm({ kind }: { kind: AuthKind }) {
  const router = useRouter();
  const auth = useAuth();
  const [values, setValues] = useState<LoginInput | RegisterInput>(kind === "login" ? initialLogin : initialRegister);
  const [errors, setErrors] = useState<FieldErrors<LoginInput & RegisterInput>>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const update = (name: string, value: string | boolean) => { setValues((current) => ({ ...current, [name]: value })); setErrors((current) => ({ ...current, [name]: undefined })); };
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
    <input id={name} name={name} type={type} autoComplete={autoComplete} value={String((values as unknown as Record<string, unknown>)[name] ?? "")} onChange={(e) => update(name, e.target.value)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} />
    {errors[name] && <span className="field-error" id={`${name}-error`}>{errors[name]}</span>}
  </div>;
  const register = values as RegisterInput;
  const login = values as LoginInput;
  return <>
    <Image className="auth-logo" src="/assets/logo.svg" alt="BuddyScript" width={185} height={46} priority />
    <p className="auth-eyebrow">{kind === "login" ? "Welcome back" : "Get Started Now"}</p>
    <h1>{kind === "login" ? "Login to your account" : "Registration"}</h1>
    <button className="google-button" type="button" disabled aria-label="Google authentication is not available in this demo"><Image src="/assets/google.svg" alt="" width={20} height={20} />{kind === "login" ? "Or sign-in with google" : "Register with google"}</button>
    <div className="or-divider"><span>Or</span></div>
    <form onSubmit={submit} noValidate>
      {kind === "register" && <>{input("firstName", "First name", "text", "given-name")}{input("lastName", "Last name", "text", "family-name")}</>}
      {input("email", "Email", "email", "email")}
      {input("password", "Password", "password", kind === "login" ? "current-password" : "new-password")}
      {kind === "register" && input("confirmPassword", "Repeat Password", "password", "new-password")}
      <div className="form-options">
        <label className="check"><input type="checkbox" checked={kind === "login" ? login.remember : register.acceptedTerms} disabled={kind === "login"} onChange={(e) => update(kind === "login" ? "remember" : "acceptedTerms", e.target.checked)} /><span>{kind === "login" ? "Secure session managed automatically" : "I agree to terms & conditions"}</span></label>
        {kind === "login" && <button className="text-button" type="button" disabled>Forgot password?</button>}
      </div>
      {errors.acceptedTerms && <span className="field-error">{errors.acceptedTerms}</span>}
      {message && <div className="form-alert" role="alert">{message}</div>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "Please wait..." : kind === "login" ? "Login now" : "Create account"}</button>
    </form>
    <p className="auth-switch">{kind === "login" ? "Don't have an account?" : "Already have an account?"} <Link href={kind === "login" ? "/register" : "/login"}>{kind === "login" ? "Create New Account" : "Login now"}</Link></p>
  </>;
}
