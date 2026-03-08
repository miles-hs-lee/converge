import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGoogleScopeString } from "@/lib/google";
import { serverEnv } from "@/lib/env/server";
import { syncGoogleCalendarSnapshot } from "@/lib/google-sync";
import { getOAuthConnectionSecret, upsertOAuthConnectionSecret } from "@/lib/oauth-connection-secrets";
import { analyticsEvents } from "@/lib/analytics/events";
import { captureServerEvent } from "@/lib/analytics/server";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfoResponse = {
  sub?: string;
  email?: string;
  name?: string;
};

async function redirectWithStatus(request: NextRequest, status: string, distinctId: string = "anonymous"): Promise<NextResponse> {
  const successStatuses = new Set(["google_oauth_connected", "google_oauth_connected_partial_sync"]);
  if (!successStatuses.has(status)) {
    await captureServerEvent({
      event: analyticsEvents.oauthFailed,
      distinctId,
      properties: {
        provider: "google",
        reasonCode: status
      }
    });
  }
  const response = NextResponse.redirect(new URL(`/settings?status=${status}`, request.url));
  response.cookies.set("converge_google_oauth_state", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}


export async function GET(request: NextRequest) {
  if (!serverEnv.googleClientId || !serverEnv.googleClientSecret || !serverEnv.googleRedirectUri) {
    return redirectWithStatus(request, "google_config_missing");
  }

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const state = request.nextUrl.searchParams.get("state");
  const stateCookie = request.cookies.get("converge_google_oauth_state")?.value;

  if (error) {
    return redirectWithStatus(request, "google_oauth_error");
  }

  if (!state || !stateCookie || state !== stateCookie) {
    return redirectWithStatus(request, "google_invalid_state");
  }

  if (!code) {
    return redirectWithStatus(request, "google_missing_code");
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return redirectWithStatus(request, "auth_required");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: serverEnv.googleClientId,
      client_secret: serverEnv.googleClientSecret,
      code,
      redirect_uri: serverEnv.googleRedirectUri,
      grant_type: "authorization_code",
      scope: getGoogleScopeString()
    })
  });

  if (!tokenResponse.ok) {
    return redirectWithStatus(request, "google_token_exchange_failed", user.id);
  }

  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenData.access_token) {
    return redirectWithStatus(request, "google_token_payload_invalid", user.id);
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`
    }
  });
  if (!profileResponse.ok) {
    return redirectWithStatus(request, "google_profile_failed", user.id);
  }
  const profile = (await profileResponse.json()) as GoogleUserInfoResponse;
  if (!profile.sub || !profile.email) {
    return redirectWithStatus(request, "google_profile_incomplete", user.id);
  }

  const expiresIn = Number(tokenData.expires_in || 3600);
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const scopes = (tokenData.scope ?? "").split(" ").filter(Boolean);

  const adminClient = createAdminClient();

  const { data: primaryConnection, error: primaryCheckError } = await adminClient
    .from("m365_connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_primary", true)
    .maybeSingle();
  if (primaryCheckError) {
    return redirectWithStatus(request, "db_primary_check_failed", user.id);
  }

  const { data: existingConnection, error: existingConnectionError } = await adminClient
    .from("m365_connections")
    .select("id,is_primary")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .eq("tenant_id", "google")
    .eq("m365_user_id", profile.sub)
    .maybeSingle();
  if (existingConnectionError) {
    return redirectWithStatus(request, "db_connection_read_failed", user.id);
  }

  let existingSecret = null;
  if (existingConnection?.id) {
    try {
      existingSecret = await getOAuthConnectionSecret(existingConnection.id);
    } catch {
      return redirectWithStatus(request, "db_connection_read_failed", user.id);
    }
  }
  const refreshToken = tokenData.refresh_token ?? existingSecret?.refresh_token_enc;
  if (!refreshToken) {
    return redirectWithStatus(request, "google_refresh_token_missing", user.id);
  }

  const shouldBePrimary = existingConnection?.is_primary ?? !primaryConnection;

  const { error: appUserError } = await adminClient.from("app_users").upsert(
    {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name ?? user.email,
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );
  if (appUserError) {
    return redirectWithStatus(request, "db_app_user_failed", user.id);
  }

  const { error: connectionError } = await adminClient.from("m365_connections").upsert(
    {
      user_id: user.id,
      provider: "google",
      tenant_id: "google",
      tenant_name: "Google",
      m365_user_id: profile.sub,
      m365_user_principal_name: profile.email,
      access_token_enc: "__migrated__",
      refresh_token_enc: "__migrated__",
      token_expires_at: tokenExpiresAt,
      scopes,
      is_primary: shouldBePrimary,
      status: "active",
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,tenant_id,m365_user_id" }
  );
  if (connectionError) {
    return redirectWithStatus(request, "db_connection_upsert_failed", user.id);
  }

  const { data: connectionRow, error: connectionReadError } = await adminClient
    .from("m365_connections")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .eq("tenant_id", "google")
    .eq("m365_user_id", profile.sub)
    .maybeSingle();
  if (connectionReadError || !connectionRow?.id) {
    return redirectWithStatus(request, "db_connection_read_failed", user.id);
  }

  const secretStored = await upsertOAuthConnectionSecret({
    connectionId: connectionRow.id,
    accessToken: tokenData.access_token,
    refreshToken
  });
  if (!secretStored) {
    return redirectWithStatus(request, "db_connection_secret_upsert_failed", user.id);
  }

  const syncResult = await syncGoogleCalendarSnapshot({
    accessToken: tokenData.access_token,
    accountEmail: profile.email,
    connectionId: connectionRow.id,
    adminClient
  });

  if (!syncResult.ok) {
    return redirectWithStatus(request, "google_oauth_connected_sync_failed", user.id);
  }

  if (syncResult.partial) {
    await captureServerEvent({
      event: analyticsEvents.oauthConnected,
      distinctId: user.id,
      properties: {
        provider: "google",
        tenantId: "google",
        tenantName: "Google",
        scopesCount: scopes.length,
        syncedCount: syncResult.syncedCount,
        partial: true
      }
    });
    return redirectWithStatus(request, "google_oauth_connected_partial_sync", user.id);
  }

  await captureServerEvent({
    event: analyticsEvents.oauthConnected,
    distinctId: user.id,
    properties: {
      provider: "google",
      tenantId: "google",
      tenantName: "Google",
      scopesCount: scopes.length,
      syncedCount: syncResult.syncedCount,
      partial: false
    }
  });

  return redirectWithStatus(request, "google_oauth_connected", user.id);
}
