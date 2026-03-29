import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("todoist_token")?.value;

  if (!token) {
    return NextResponse.json(
      { error: "Not authenticated. Please connect Todoist first." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const res = await fetch("https://api.todoist.com/api/v1/tasks", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Todoist add-task error:", res.status, text);
      return NextResponse.json(
        { error: "Todoist API error" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Add task error:", err);
    return NextResponse.json(
      { error: "Failed to add task" },
      { status: 500 }
    );
  }
}
