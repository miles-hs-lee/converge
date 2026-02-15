import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/server";
import { getGoogleScopeString } from "@/lib/google";

export async function GET(request: Request) {
  if (!serverEnv.googleClientId || !serverEnv.googleRedirectUri) {
    return NextResponse.redirect(new URL("/settings?status=google_config_missing", request.url));
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: serverEnv.googleClientId,
    response_type: "code",
    redirect_uri: serverEnv.googleRedirectUri,
    scope: getGoogleScopeString(),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  const response = NextResponse.redirect(authUrl);
  response.cookies.set("converge_google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10
  });
  return response;
}
