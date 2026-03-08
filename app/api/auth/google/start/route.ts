import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/server";
import { getGoogleScopeString } from "@/lib/google";
import { createClient } from "@/lib/supabase/server";
import { analyticsEvents } from "@/lib/analytics/events";
import { captureServerEvent } from "@/lib/analytics/server";

export async function GET(request: Request) {
  if (!serverEnv.googleClientId || !serverEnv.googleRedirectUri) {
    await captureServerEvent({
      event: analyticsEvents.oauthFailed,
      distinctId: "anonymous",
      properties: { provider: "google", reasonCode: "google_config_missing", flow: "direct_connect", surface: "settings" }
    });
    return NextResponse.redirect(new URL("/settings?status=google_config_missing", request.url));
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    await captureServerEvent({
      event: analyticsEvents.oauthFailed,
      distinctId: "anonymous",
      properties: { provider: "google", reasonCode: "auth_required", flow: "direct_connect", surface: "settings" }
    });
    return NextResponse.redirect(new URL("/login?status=auth_required", request.url));
  }

  await captureServerEvent({
    event: analyticsEvents.oauthStart,
    distinctId: user.id,
    properties: { provider: "google", flow: "direct_connect", surface: "settings" }
  });

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
