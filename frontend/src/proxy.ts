import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const signedIn = request.cookies.has("buddy_session");
  if (!signedIn && request.nextUrl.pathname.startsWith("/feed")) return NextResponse.redirect(new URL("/login?next=/feed", request.url));
  if (signedIn && ["/login", "/register"].includes(request.nextUrl.pathname)) return NextResponse.redirect(new URL("/feed", request.url));
  return NextResponse.next();
}
export const config = { matcher: ["/feed/:path*", "/login", "/register"] };
