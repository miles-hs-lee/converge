import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/server";
import { getMicrosoftScopeString } from "@/lib/microsoft";
import { createClient } from "@/lib/supabase/server";
import { analyticsEvents } from "@/lib/analytics/events";
import { captureServerEvent } from "@/lib/analytics/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    await captureServerEvent({
      event: analyticsEvents.oauthFailed,
      distinctId: "anonymous",
      properties: { provider: "microsoft", reasonCode: "auth_required", flow: "direct_connect", surface: "settings" }
    });
    return NextResponse.redirect(new URL("/login?status=auth_required", serverEnv.azureRedirectUri));
  }

  await captureServerEvent({
    event: analyticsEvents.oauthStart,
    distinctId: user.id,
    properties: { provider: "microsoft", flow: "direct_connect", surface: "settings" }
  });

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: serverEnv.azureClientId,
    response_type: "code",
    redirect_uri: serverEnv.azureRedirectUri,
    response_mode: "query",
    scope: getMicrosoftScopeString(),
    state,
    prompt: "select_account"
  });

  const authUrl = `https://login.microsoftonline.com/${serverEnv.azureTenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  const response = NextResponse.redirect(authUrl);
  response.cookies.set("converge_ms_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10
  });
  return response;
}
