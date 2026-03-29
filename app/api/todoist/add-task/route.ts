import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getProjectNameForEmail } from "../../../../lib/todoistProjectRules";

async function findProjectId(
  token: string,
  projectName: string
): Promise<string | null> {
  try {
    const res = await fetch("https://api.todoist.com/api/v1/projects", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const projects = await res.json();
    const match = projects.find(
      (p: { name: string }) => p.name === projectName
    );
    return match?.id || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("todoist_token")?.value;
  const email = cookieStore.get("todoist_email")?.value || null;

  if (!token) {
    return NextResponse.json(
      { error: "Not authenticated. Please connect Todoist first." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    // Auto-select project based on connected account email
    if (!body.project_id) {
      const targetProjectName = getProjectNameForEmail(email);
      const projectId = await findProjectId(token, targetProjectName);
      if (projectId) {
        body.project_id = projectId;
      } else {
        console.warn(
          `Project "${targetProjectName}" not found for ${email}, using inbox`
        );
      }
    }

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
