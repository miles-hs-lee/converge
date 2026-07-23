import * as Sentry from "@sentry/nextjs";
import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decodeJwtPayload, getMicrosoftScopeString } from "@/lib/microsoft";
import { syncMicrosoftCalendarSnapshot, syncMicrosoftPeopleSnapshot } from "@/lib/microsoft-sync";
import { upsertOAuthConnectionSecret } from "@/lib/oauth-connection-secrets";
import { serverEnv } from "@/lib/env/server";
import { analyticsEvents } from "@/lib/analytics/events";
import { captureServerEvent } from "@/lib/analytics/server";
import { applyStandardSentryScopeTags } from "@/lib/observability/sentry-tags";

type MicrosoftTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type IdTokenClaims = {
  tid?: string;
  oid?: string;
  preferred_username?: string;
  name?: string;
};

type MicrosoftMeResponse = {
  id: string;
  displayName?: string;
  userPrincipalName?: string;
  mail?: string;
};

function parseRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as Record<string, unknown>;
}

function deriveTenantName(me: MicrosoftMeResponse, tenantId: string): string {
  const account = me.userPrincipalName ?? me.mail ?? "";
  const domain = account.includes("@") ? account.split("@")[1]?.trim() : "";
  if (domain) {
    return domain;
  }
  return tenantId;
}

function scheduleInitialMicrosoftSync(params: {
  accessToken: string;
  accountEmail: string;
  connectionId: string;
  existingSyncState: Record<string, unknown>;
  userId: string;
  tenantId: string;
  tenantName: string;
  scopesCount: number;
}) {
  after(async () => {
    const {
      accessToken,
      accountEmail,
      connectionId,
      existingSyncState,
      scopesCount,
      tenantId,
      tenantName,
      userId
    } = params;
    const adminClient = createAdminClient();
    const existingCalendarState = parseRecord(existingSyncState.calendar);
    const existingPeopleState = parseRecord(existingSyncState.people);

    try {
      const [calendarSync, peopleSync] = await Promise.all([
        syncMicrosoftCalendarSnapshot({
          accessToken,
          accountEmail,
          connectionId,
          calendarState: existingCalendarState,
          adminClient
        }),
        syncMicrosoftPeopleSnapshot({
          accessToken,
          connectionId,
          adminClient
        })
      ]);
      const attemptedAt = new Date().toISOString();

      const { error: syncStateError } = await adminClient
        .from("m365_connections")
        .update({
          sync_state: {
            ...existingSyncState,
            security: {
              reauthRequired: false,
              reason: null,
              clearedAt: attemptedAt
            },
            calendar: {
              ...existingCalendarState,
              ...(calendarSync.statePatch ?? {}),
              ok: calendarSync.ok,
              partial: calendarSync.partial,
              syncedCount: calendarSync.syncedCount,
              lastAttemptAt: attemptedAt,
              ...(calendarSync.ok ? { syncedAt: attemptedAt, lastErrorAt: null } : { lastErrorAt: attemptedAt })
            },
            people: {
              ...existingPeopleState,
              ...(peopleSync.statePatch ?? {}),
              ok: peopleSync.ok,
              partial: peopleSync.partial,
              syncedCount: peopleSync.syncedCount,
              lastAttemptAt: attemptedAt,
              ...(peopleSync.ok ? { syncedAt: attemptedAt, lastErrorAt: null } : { lastErrorAt: attemptedAt })
            }
          },
          updated_at: attemptedAt
        })
        .eq("id", connectionId);
      if (syncStateError) {
        throw new Error(`initial_sync_state_update_failed:${syncStateError.message}`);
      }

      await captureServerEvent({
        event: analyticsEvents.oauthConnected,
        distinctId: userId,
        properties: {
          provider: "microsoft",
          tenantId,
          tenantName,
          scopesCount,
          calendarSyncedCount: calendarSync.syncedCount,
          peopleSyncedCount: peopleSync.syncedCount,
          calendarPartial: calendarSync.partial,
          peoplePartial: peopleSync.partial,
          calendarOk: calendarSync.ok,
          peopleOk: peopleSync.ok
        }
      });
    } catch (error) {
      Sentry.withScope((scope) => {
        applyStandardSentryScopeTags(scope, {
          route: "/api/auth/microsoft/callback",
          provider: "microsoft",
          syncMode: "all"
        });
        scope.setUser({ id: userId });
        scope.setTag("task", "initial_connection_sync");
        Sentry.captureException(error);
      });
    }
  });
}

async function redirectWithStatus(request: NextRequest, status: string, distinctId: string = "anonymous"): Promise<NextResponse> {
  if (status !== "oauth_connected") {
    await captureServerEvent({
      event: analyticsEvents.oauthFailed,
      distinctId,
      properties: {
        provider: "microsoft",
        reasonCode: status
      }
    });
  }
  const response = NextResponse.redirect(new URL(`/settings?status=${status}`, request.url));
  response.cookies.set("converge_ms_oauth_state", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const state = request.nextUrl.searchParams.get("state");
  const stateCookie = request.cookies.get("converge_ms_oauth_state")?.value;

  if (error) {
    return redirectWithStatus(request, "oauth_error");
  }

  if (!state || !stateCookie || state !== stateCookie) {
    return redirectWithStatus(request, "invalid_state");
  }

  if (!code) {
    return redirectWithStatus(request, "missing_code");
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return redirectWithStatus(request, "auth_required");
  }

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${serverEnv.azureTenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: serverEnv.azureClientId,
        client_secret: serverEnv.azureClientSecret,
        code,
        redirect_uri: serverEnv.azureRedirectUri,
        grant_type: "authorization_code",
        scope: getMicrosoftScopeString()
      })
    }
  );

  if (!tokenResponse.ok) {
    return redirectWithStatus(request, "token_exchange_failed", user.id);
  }

  const tokenData = (await tokenResponse.json()) as MicrosoftTokenResponse;
  if (!tokenData.access_token || !tokenData.refresh_token) {
    return redirectWithStatus(request, "token_payload_invalid", user.id);
  }

  const meResponse = await fetch("https://graph.microsoft.com/v1.0/me?$select=id,displayName,userPrincipalName,mail", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`
    }
  });
  if (!meResponse.ok) {
    return redirectWithStatus(request, "graph_me_failed", user.id);
  }

  const me = (await meResponse.json()) as MicrosoftMeResponse;
  const idClaims = tokenData.id_token ? decodeJwtPayload<IdTokenClaims>(tokenData.id_token) : null;
  const tenantId = idClaims?.tid;
  const scopes = (tokenData.scope ?? "").split(" ").filter(Boolean);
  const expiresIn = Number(tokenData.expires_in || 3600);
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  if (!tenantId || !me.id) {
    return redirectWithStatus(request, "profile_incomplete", user.id);
  }

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
    .eq("tenant_id", tenantId)
    .eq("m365_user_id", me.id)
    .maybeSingle();
  if (existingConnectionError) {
    return redirectWithStatus(request, "db_connection_read_failed", user.id);
  }

  const shouldBePrimary = existingConnection?.is_primary ?? !primaryConnection;
  const tenantName = deriveTenantName(me, tenantId);

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
      provider: "microsoft",
      tenant_id: tenantId,
      tenant_name: tenantName,
      m365_user_id: me.id,
      m365_user_principal_name: me.userPrincipalName ?? idClaims?.preferred_username ?? null,
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
    .select("id,sync_state")
    .eq("user_id", user.id)
    .eq("provider", "microsoft")
    .eq("tenant_id", tenantId)
    .eq("m365_user_id", me.id)
    .maybeSingle();
  if (connectionReadError || !connectionRow?.id) {
    return redirectWithStatus(request, "db_connection_read_failed", user.id);
  }

  const secretStored = await upsertOAuthConnectionSecret({
    connectionId: connectionRow.id,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token
  });
  if (!secretStored) {
    return redirectWithStatus(request, "db_connection_secret_upsert_failed", user.id);
  }

  const accountEmail = me.userPrincipalName ?? me.mail ?? user.email;
  const existingSyncState = parseRecord(connectionRow.sync_state);
  const connectedAt = new Date().toISOString();
  const { error: securityStateError } = await adminClient
    .from("m365_connections")
    .update({
      sync_state: {
        ...existingSyncState,
        security: {
          reauthRequired: false,
          reason: null,
          clearedAt: connectedAt
        }
      },
      updated_at: connectedAt
    })
    .eq("id", connectionRow.id);
  if (securityStateError) {
    return redirectWithStatus(request, "db_connection_upsert_failed", user.id);
  }

  scheduleInitialMicrosoftSync({
    accessToken: tokenData.access_token,
    accountEmail,
    connectionId: connectionRow.id,
    existingSyncState,
    userId: user.id,
    tenantId,
    tenantName,
    scopesCount: scopes.length
  });

  return redirectWithStatus(request, "oauth_connected", user.id);
}
