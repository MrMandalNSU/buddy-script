import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/components/AuthForm";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { GuestGuard } from "@/features/auth/AuthGuard";
export const metadata: Metadata = { title: "Login" };
export default function LoginPage() { return <GuestGuard><AuthShell kind="login"><AuthForm kind="login" /></AuthShell></GuestGuard>; }
