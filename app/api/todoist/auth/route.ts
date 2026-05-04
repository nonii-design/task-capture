import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";

export async function GET() {
  const clientId = process.env.TODOIST_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "TODOIST_CLIENT_ID not configured" },
      { status: 500 }
    );
  }

  const state = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("todoist_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/todoist/callback`;
  console.log("[Todoist auth] starting OAuth", {
    redirectUri,
    statePrefix: state.slice(0, 8),
  });
  const params = new URLSearchParams({
    client_id: clientId,
    scope: "task:add,data:read",
    state,
    redirect_uri: redirectUri,
  });

  return NextResponse.redirect(
    `https://todoist.com/oauth/authorize?${params.toString()}`
  );
}
