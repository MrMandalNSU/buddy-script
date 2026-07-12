import { NextResponse } from "next/server";
export async function DELETE() {
  const response = NextResponse.json({ ok: true, data: null });
  response.cookies.delete("buddy_session");
  return response;
}
