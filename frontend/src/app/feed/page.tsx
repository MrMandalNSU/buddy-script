import type { Metadata } from "next";
import { FeedApp } from "@/features/feed/components/FeedApp";
export const metadata: Metadata = { title: "Feed" };
export default function FeedPage() { return <FeedApp />; }
