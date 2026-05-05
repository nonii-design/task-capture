import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

function errorRedirect(code: string, detail?: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  const params = new URLSearchParams({ todoist_error: code });
  if (detail) params.set("detail", detail.slice(0, 200));
  return NextResponse.redirect(`${base}/?${params.toString()}`);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  console.log("[Todoist callback]", {
    hasCode: !!code,
    hasState: !!state,
    error,
    errorDescription,
  });

  if (error) {
    return errorRedirect(error, errorDescription || undefined);
  }

  if (!code || !state) {
    return errorRedirect("missing_params", `code=${!!code}&state=${!!state}`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("todoist_oauth_state")?.value;
  if (state !== savedState) {
    console.error("[Todoist callback] state mismatch", {
      received: state.slice(0, 8),
      saved: savedState?.slice(0, 8) || "(none)",
    });
    return errorRedirect(
      "invalid_state",
      savedState ? "state_mismatch" : "no_saved_state_cookie"
    );
  }

  const tokenParams = new URLSearchParams();
  tokenParams.set("client_id", process.env.TODOIST_CLIENT_ID || "");
  tokenParams.set("client_secret", process.env.TODOIST_CLIENT_SECRET || "");
  tokenParams.set("code", code);

  const tokenRes = await fetch("https://todoist.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error("Token exchange failed:", tokenRes.status, text);
    return errorRedirect("token_exchange_failed", `${tokenRes.status}:${text.slice(0, 100)}`);
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
