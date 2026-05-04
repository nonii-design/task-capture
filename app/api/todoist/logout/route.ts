import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("todoist_token");
  cookieStore.delete("todoist_email");
  cookieStore.delete("todoist_oauth_state");
  return NextResponse.json({ success: true });
}
