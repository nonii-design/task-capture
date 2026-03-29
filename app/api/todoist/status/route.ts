import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("todoist_token")?.value;

  if (!token) {
    return NextResponse.json({ connected: false });
  }

  // Verify token is still valid
  try {
    const res = await fetch("https://api.todoist.com/api/v1/projects", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      return NextResponse.json({ connected: true });
    }
    return NextResponse.json({ connected: false });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
