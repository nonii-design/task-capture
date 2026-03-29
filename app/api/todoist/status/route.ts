import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getProjectNameForEmail } from "../../../../lib/todoistProjectRules";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("todoist_token")?.value;
  const email = cookieStore.get("todoist_email")?.value || null;

  if (!token) {
    return NextResponse.json({ connected: false });
  }

  try {
    const res = await fetch("https://api.todoist.com/api/v1/projects", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const projectName = getProjectNameForEmail(email);
      return NextResponse.json({
        connected: true,
        email,
        projectName,
      });
    }
    return NextResponse.json({ connected: false });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
