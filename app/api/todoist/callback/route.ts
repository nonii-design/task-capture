import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?todoist_error=${error}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?todoist_error=missing_params`
    );
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("todoist_oauth_state")?.value;
  if (state !== savedState) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?todoist_error=invalid_state`
    );
  }

  const tokenRes = await fetch("https://todoist.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.TODOIST_CLIENT_ID,
      client_secret: process.env.TODOIST_CLIENT_SECRET,
      code,
    }),
  });

  if (!tokenRes.ok) {
    console.error("Token exchange failed:", tokenRes.status, await tokenRes.text());
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?todoist_error=token_exchange_failed`
    );
  }

  const { access_token } = await tokenRes.json();

  // Fetch user email from Todoist Sync API (uses form-urlencoded, not JSON)
  let userEmail = "";
  try {
    const params = new URLSearchParams();
    params.append("sync_token", "*");
    params.append("resource_types", '["user"]');
    const userRes = await fetch("https://api.todoist.com/sync/v9/sync", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      userEmail = userData.user?.email || "";
    } else {
      console.error("Sync API error:", userRes.status, await userRes.text());
    }
  } catch (e) {
    console.error("Failed to fetch user email:", e);
  }

  const response = NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/?todoist_connected=true`
  );

  response.cookies.set("todoist_token", access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  if (userEmail) {
    response.cookies.set("todoist_email", userEmail, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  response.cookies.delete("todoist_oauth_state");

  return response;
}
