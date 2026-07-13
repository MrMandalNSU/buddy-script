import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/components/AuthForm";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { GuestGuard } from "@/features/auth/AuthGuard";
export const metadata: Metadata = { title: "Register" };
export default function RegisterPage() { return <GuestGuard><AuthShell kind="register"><AuthForm kind="register" /></AuthShell></GuestGuard>; }
