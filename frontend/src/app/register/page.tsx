import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/components/AuthForm";
import { AuthShell } from "@/features/auth/components/AuthShell";
export const metadata: Metadata = { title: "Register" };
export default function RegisterPage() { return <AuthShell kind="register"><AuthForm kind="register" /></AuthShell>; }
