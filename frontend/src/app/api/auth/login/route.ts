import { NextResponse } from "next/server";
import { validateLogin } from "@/features/auth/validation";
import type { LoginInput, Session } from "@/features/auth/types";

export async function POST(request: Request) {
  const input = await request.json() as LoginInput;
  const fieldErrors = validateLogin(input);
  if (Object.keys(fieldErrors).length) return NextResponse.json({ ok: false, error: { code: "VALIDATION", message: "Check the highlighted fields.", fieldErrors } }, { status: 400 });
  const session: Session = { user: { id: "user-me", firstName: "Alex", lastName: "Morgan", email: input.email, avatarUrl: "/assets/txt_img.png", headline: "Product designer at BuddyScript" }, expiresAt: new Date(Date.now() + 86_400_000).toISOString() };
  const response = NextResponse.json({ ok: true, data: session });
  response.cookies.set("buddy_session", "demo-user-me", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: input.remember ? 60 * 60 * 24 * 30 : undefined });
  return response;
}
