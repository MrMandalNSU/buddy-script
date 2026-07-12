import { NextResponse } from "next/server";
import { validateRegistration } from "@/features/auth/validation";
import type { RegisterInput, Session } from "@/features/auth/types";

export async function POST(request: Request) {
  const input = await request.json() as RegisterInput;
  const fieldErrors = validateRegistration(input);
  if (Object.keys(fieldErrors).length) return NextResponse.json({ ok: false, error: { code: "VALIDATION", message: "Check the highlighted fields.", fieldErrors } }, { status: 400 });
  const session: Session = { user: { id: "user-me", firstName: input.firstName.trim(), lastName: input.lastName.trim(), email: input.email.trim(), avatarUrl: "/assets/txt_img.png", headline: "New to BuddyScript" }, expiresAt: new Date(Date.now() + 86_400_000).toISOString() };
  const response = NextResponse.json({ ok: true, data: session });
  response.cookies.set("buddy_session", "demo-user-me", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  return response;
}
