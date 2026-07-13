import type { Metadata } from "next";
import { FeedApp } from "@/features/feed/components/FeedApp";
import { AuthGuard } from "@/features/auth/AuthGuard";
export const metadata: Metadata = { title: "Feed" };
export default function FeedPage() { return <AuthGuard><FeedApp /></AuthGuard>; }
