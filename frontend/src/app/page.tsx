import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  redirect((await cookies()).has("buddy_session") ? "/feed" : "/login");
}
