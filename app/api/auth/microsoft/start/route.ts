import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env/server";
import { getMicrosoftScopeString } from "@/lib/microsoft";

export async function GET() {
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
