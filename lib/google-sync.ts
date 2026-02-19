import { createAdminClient } from "@/lib/supabase/admin";

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

export type CalendarSyncResult = {
  ok: boolean;
  partial: boolean;
  syncedCount: number;
};

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

export async function syncGoogleCalendarSnapshot(params: {
  accessToken: string;
  accountEmail: string;
  connectionId: string;
  adminClient: ReturnType<typeof createAdminClient>;
}): Promise<CalendarSyncResult> {
  const { accessToken, accountEmail, connectionId, adminClient } = params;

  const calendarListResponse = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=16", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!calendarListResponse.ok) {
    return { ok: false, partial: false, syncedCount: 0 };
  }

  const calendarListData = (await calendarListResponse.json()) as GoogleCalendarListResponse;
  const calendars = (calendarListData.items ?? []).filter((calendar): calendar is Required<Pick<GoogleCalendarListItem, "id">> & GoogleCalendarListItem => Boolean(calendar.id));

  if (calendars.length === 0) {
    return { ok: true, partial: false, syncedCount: 0 };
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
    return { ok: false, partial: false, syncedCount: 0 };
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
    return { ok: false, partial: false, syncedCount: 0 };
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

    const query = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      timeMin: fromIso,
      timeMax: toIsoDate
    });

    const eventsResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id!)}/events?${query.toString()}`, {
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
      return { ok: false, partial: partialFailure, syncedCount: 0 };
    }
  }

  return { ok: true, partial: partialFailure, syncedCount: eventRows.length };
}
