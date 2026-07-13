"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/features/auth/AuthProvider";
export default function Home() { const auth = useAuth(); const router = useRouter(); useEffect(() => { if (auth.status !== "loading") router.replace(auth.status === "authenticated" ? "/feed" : "/login"); }, [auth.status, router]); return <main className="auth-loading" aria-live="polite"><p>Opening BuddyScript…</p></main>; }
