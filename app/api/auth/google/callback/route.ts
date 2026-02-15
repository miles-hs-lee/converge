import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGoogleScopeString } from "@/lib/google";
import { serverEnv } from "@/lib/env/server";

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

type GoogleCalendarListItem = {
  id?: string;
  summary?: string;
  backgroundColor?: string;
};

type GoogleCalendarListResponse = {
  items?: GoogleCalendarListItem[];
};

type GoogleEventDateField = {
  dateTime?: string;
  date?: string;
};

type GoogleCalendarEvent = {
  id?: string;
  status?: string;
  summary?: string;
  start?: GoogleEventDateField;
  end?: GoogleEventDateField;
  location?: string;
  organizer?: {
    email?: string;
  };
  attendees?: Array<{
    email?: string;
  }>;
  htmlLink?: string;
  updated?: string;
};

type GoogleCalendarEventsResponse = {
  items?: GoogleCalendarEvent[];
};

function redirectWithStatus(request: NextRequest, status: string): NextResponse {
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

function toIso(dateField?: GoogleEventDateField): string | null {
  if (!dateField) {
    return null;
  }

  if (dateField.dateTime) {
    const parsed = new Date(dateField.dateTime);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (dateField.date) {
    const parsed = new Date(`${dateField.date}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
}

function fallbackEnd(startIso: string, isAllDay: boolean): string {
  const start = new Date(startIso);
  if (isAllDay) {
    start.setDate(start.getDate() + 1);
  } else {
    start.setMinutes(start.getMinutes() + 30);
  }
  return start.toISOString();
}

async function syncGoogleCalendarSnapshot(params: {
  accessToken: string;
  accountEmail: string;
  connectionId: string;
  adminClient: ReturnType<typeof createAdminClient>;
}) {
  const { accessToken, accountEmail, connectionId, adminClient } = params;

  const calendarListResponse = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=8", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!calendarListResponse.ok) {
    return { ok: false as const, partial: false, syncedCount: 0 };
  }

  const calendarListData = (await calendarListResponse.json()) as GoogleCalendarListResponse;
  const calendars = (calendarListData.items ?? []).filter((calendar): calendar is Required<Pick<GoogleCalendarListItem, "id">> & GoogleCalendarListItem => Boolean(calendar.id));

  if (calendars.length === 0) {
    return { ok: true as const, partial: false, syncedCount: 0 };
  }

  const nowIso = new Date().toISOString();
  const sourceRows = calendars.map((calendar) => ({
    connection_id: connectionId,
    external_calendar_id: calendar.id!,
    name: calendar.summary ?? "Google Calendar",
    color: calendar.backgroundColor ?? "#0284c7",
    is_selected: true,
    last_synced_at: nowIso
  }));

  const { error: sourceUpsertError } = await adminClient
    .from("calendar_sources")
    .upsert(sourceRows, { onConflict: "connection_id,external_calendar_id" });
  if (sourceUpsertError) {
    return { ok: false as const, partial: false, syncedCount: 0 };
  }

  const { data: sourceData, error: sourceSelectError } = await adminClient
    .from("calendar_sources")
    .select("id,external_calendar_id")
    .eq("connection_id", connectionId)
    .in(
      "external_calendar_id",
      calendars.map((calendar) => calendar.id!)
    );
  if (sourceSelectError) {
    return { ok: false as const, partial: false, syncedCount: 0 };
  }

  const sourceByExternalId = new Map<string, string>();
  (sourceData ?? []).forEach((source) => {
    sourceByExternalId.set(source.external_calendar_id, source.id);
  });

  const fromIso = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString();
  const toIsoDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 21).toISOString();

  const eventRows: Array<Record<string, unknown>> = [];
  let partialFailure = false;

  for (const calendar of calendars) {
    const sourceId = sourceByExternalId.get(calendar.id!);
    if (!sourceId) {
      partialFailure = true;
      continue;
    }

    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "120",
      timeMin: fromIso,
      timeMax: toIsoDate
    });

    const eventsResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id!)}/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!eventsResponse.ok) {
      partialFailure = true;
      continue;
    }

    const eventsData = (await eventsResponse.json()) as GoogleCalendarEventsResponse;
    const events = eventsData.items ?? [];

    events.forEach((event) => {
      if (!event.id || event.status === "cancelled") {
        return;
      }

      const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
      const startAt = toIso(event.start);
      if (!startAt) {
        return;
      }
      const endAt = toIso(event.end) ?? fallbackEnd(startAt, isAllDay);

      const attendees = (event.attendees ?? []).map((attendee) => attendee.email).filter((email): email is string => Boolean(email));

      eventRows.push({
        connection_id: connectionId,
        calendar_source_id: sourceId,
        external_event_id: `${calendar.id}:${event.id}`,
        subject: event.summary ?? "(제목 없음)",
        start_at: startAt,
        end_at: endAt,
        is_all_day: isAllDay,
        location: event.location ?? null,
        organizer: event.organizer?.email ?? accountEmail,
        attendees,
        web_link: event.htmlLink ?? null,
        last_modified_external: event.updated ?? null,
        synced_at: nowIso
      });
    });
  }

  if (eventRows.length > 0) {
    const { error: eventUpsertError } = await adminClient
      .from("calendar_events_cache")
      .upsert(eventRows, { onConflict: "connection_id,external_event_id" });
    if (eventUpsertError) {
      return { ok: false as const, partial: partialFailure, syncedCount: 0 };
    }
  }

  return { ok: true as const, partial: partialFailure, syncedCount: eventRows.length };
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
    return redirectWithStatus(request, "google_token_exchange_failed");
  }

  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenData.access_token) {
    return redirectWithStatus(request, "google_token_payload_invalid");
  }

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`
    }
  });
  if (!profileResponse.ok) {
    return redirectWithStatus(request, "google_profile_failed");
  }
  const profile = (await profileResponse.json()) as GoogleUserInfoResponse;
  if (!profile.sub || !profile.email) {
    return redirectWithStatus(request, "google_profile_incomplete");
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
    return redirectWithStatus(request, "db_primary_check_failed");
  }

  const { data: existingConnection, error: existingConnectionError } = await adminClient
    .from("m365_connections")
    .select("id,is_primary,refresh_token_enc")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .eq("tenant_id", "google")
    .eq("m365_user_id", profile.sub)
    .maybeSingle();
  if (existingConnectionError) {
    return redirectWithStatus(request, "db_connection_read_failed");
  }

  const refreshToken = tokenData.refresh_token ?? existingConnection?.refresh_token_enc;
  if (!refreshToken) {
    return redirectWithStatus(request, "google_refresh_token_missing");
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
    return redirectWithStatus(request, "db_app_user_failed");
  }

  const { error: connectionError } = await adminClient.from("m365_connections").upsert(
    {
      user_id: user.id,
      provider: "google",
      tenant_id: "google",
      tenant_name: "Google",
      m365_user_id: profile.sub,
      m365_user_principal_name: profile.email,
      access_token_enc: tokenData.access_token,
      refresh_token_enc: refreshToken,
      token_expires_at: tokenExpiresAt,
      scopes,
      is_primary: shouldBePrimary,
      status: "active",
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,tenant_id,m365_user_id" }
  );
  if (connectionError) {
    return redirectWithStatus(request, "db_connection_upsert_failed");
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
    return redirectWithStatus(request, "db_connection_read_failed");
  }

  const syncResult = await syncGoogleCalendarSnapshot({
    accessToken: tokenData.access_token,
    accountEmail: profile.email,
    connectionId: connectionRow.id,
    adminClient
  });

  if (!syncResult.ok) {
    return redirectWithStatus(request, "google_oauth_connected_sync_failed");
  }

  if (syncResult.partial) {
    return redirectWithStatus(request, "google_oauth_connected_partial_sync");
  }

  return redirectWithStatus(request, "google_oauth_connected");
}
