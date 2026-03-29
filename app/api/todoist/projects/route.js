import { NextResponse } from "next/server";

export async function GET(req) {
  const token = req.headers.get("x-todoist-token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  try {
    console.log("Token received:", token ? token.slice(0, 6) + "..." : "NONE");
    const res = await fetch("https://api.todoist.com/api/v1/projects", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Todoist projects error:", res.status, text);
      return NextResponse.json({ error: "Todoist API error" }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}
