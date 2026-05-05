import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function GET() {
  const clientId = process.env.TODOIST_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "TODOIST_CLIENT_ID not configured" },
      { status: 500 }
    );
  }

  const state = randomBytes(32).toString("hex");
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

  // Set the cookie on the actual redirect response. Calling cookies().set()
  // before returning a freshly-created NextResponse loses the Set-Cookie
  // header, which was causing invalid_state errors on the callback.
  const response = NextResponse.redirect(
    `https://todoist.com/oauth/authorize?${params.toString()}`
  );
  response.cookies.set("todoist_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
