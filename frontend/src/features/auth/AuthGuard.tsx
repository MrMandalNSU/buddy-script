"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth(); const router = useRouter();
  useEffect(() => { if (auth.status === "anonymous") router.replace("/login?next=/feed"); }, [auth.status, router]);
  if (auth.status !== "authenticated") return <main className="auth-loading" aria-live="polite"><p>{auth.status === "loading" ? "Checking your secure session…" : "Redirecting to login…"}</p></main>;
  return children;
}
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth(); const router = useRouter(); useEffect(() => { if (auth.status === "authenticated") router.replace("/feed"); }, [auth.status, router]);
  if (auth.status === "authenticated") return null; return children;
}
