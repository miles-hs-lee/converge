import { createAdminClient } from "@/lib/supabase/admin";
import { buildCalendarWindow } from "@/lib/calendar-window";

type GoogleCalendarListItem = {
  id?: string;
  summary?: string;
  backgroundColor?: string;
  primary?: boolean;
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
  description?: string;
  created?: string;
  start?: GoogleEventDateField;
  end?: GoogleEventDateField;
  location?: string;
  eventType?: string;
  recurringEventId?: string;
  hangoutLink?: string;
  colorId?: string;
  creator?: {
    email?: string;
  };
  organizer?: {
    email?: string;
  };
  attendees?: Array<{
    displayName?: string;
    responseStatus?: string;
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
  statePatch?: Record<string, unknown>;
};

function upsertCalendarEventsFallbackRows(row: Record<string, unknown>): Record<string, unknown> {
  return {
    connection_id: row.connection_id,
    calendar_source_id: row.calendar_source_id,
    external_event_id: row.external_event_id,
    subject: row.subject,
    start_at: row.start_at,
    end_at: row.end_at,
    is_all_day: row.is_all_day,
    location: row.location,
    organizer: row.organizer,
    attendees: row.attendees,
    web_link: row.web_link,
    last_modified_external: row.last_modified_external,
    synced_at: row.synced_at
  };
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

export async function syncGoogleCalendarSnapshot(params: {
  accessToken: string;
  accountEmail: string;
  connectionId: string;
  calendarState?: Record<string, unknown>;
  adminClient: ReturnType<typeof createAdminClient>;
}): Promise<CalendarSyncResult> {
  const { accessToken, accountEmail, connectionId, calendarState, adminClient } = params;

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
  const sourceSelectionInitialized = Boolean(calendarState && calendarState.sourceSelectionInitialized);
  const { data: existingSourceData, error: existingSourceError } = await adminClient
    .from("calendar_sources")
    .select("external_calendar_id,is_selected")
    .eq("connection_id", connectionId)
    .in(
      "external_calendar_id",
      calendars.map((calendar) => calendar.id!)
    );
  if (existingSourceError) {
    return { ok: false, partial: false, syncedCount: 0 };
  }
  const existingSelectedByExternalId = new Map<string, boolean>();
  (existingSourceData ?? []).forEach((row) => {
    existingSelectedByExternalId.set(row.external_calendar_id, Boolean(row.is_selected));
  });

  const sourceRows = calendars.map((calendar) => ({
    connection_id: connectionId,
    external_calendar_id: calendar.id!,
    name: calendar.summary ?? "Google Calendar",
    color: calendar.backgroundColor ?? "#0284c7",
    is_selected:
      sourceSelectionInitialized
        ? (existingSelectedByExternalId.get(calendar.id!) ?? Boolean(calendar.primary))
        : Boolean(calendar.primary),
    last_synced_at: nowIso
  }));
  if (sourceRows.length > 0 && !sourceRows.some((row) => row.is_selected)) {
    sourceRows[0]!.is_selected = true;
  }

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

  const { fromIso, toIso: toIsoDate } = buildCalendarWindow();

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

      const attendees = (event.attendees ?? [])
        .map((attendee) => ({
          email: attendee.email ?? null,
          name: attendee.displayName ?? null,
          type: "required",
          response: attendee.responseStatus ?? null,
          respondedAt: null
        }))
        .filter((attendee) => Boolean(attendee.email || attendee.name));

      const createdExternal =
        event.created && Number.isFinite(new Date(event.created).getTime()) ? new Date(event.created).toISOString() : null;
      const lastModifiedExternal =
        event.updated && Number.isFinite(new Date(event.updated).getTime()) ? new Date(event.updated).toISOString() : null;

      eventRows.push({
        connection_id: connectionId,
        calendar_source_id: sourceId,
        external_event_id: `${calendar.id}:${event.id}`,
        subject: event.summary ?? "(제목 없음)",
        body_preview: event.description?.slice(0, 1200) ?? null,
        importance: "normal",
        sensitivity: "normal",
        categories: event.colorId ? [event.colorId] : [],
        event_type: event.eventType ?? (event.recurringEventId ? "occurrence" : "singleInstance"),
        start_at: startAt,
        end_at: endAt,
        timezone_start: null,
        timezone_end: null,
        is_all_day: isAllDay,
        is_cancelled: event.status === "cancelled",
        is_online_meeting: Boolean(event.hangoutLink),
        online_meeting_url: event.hangoutLink ?? null,
        show_as: null,
        response_status: null,
        response_time: null,
        location: event.location ?? null,
        organizer: event.organizer?.email ?? accountEmail,
        organizer_name: null,
        attendees,
        web_link: event.htmlLink ?? null,
        created_external: createdExternal,
        last_modified_external: lastModifiedExternal,
        recurrence: {},
        raw: event,
        synced_at: nowIso
      });
    });
  }

  if (eventRows.length > 0) {
    const eventUpsert = await adminClient.from("calendar_events_cache").upsert(eventRows, { onConflict: "connection_id,external_event_id" });
    if (eventUpsert.error) {
      const fallbackRows = eventRows.map(upsertCalendarEventsFallbackRows);
      const fallbackUpsert = await adminClient.from("calendar_events_cache").upsert(fallbackRows, { onConflict: "connection_id,external_event_id" });
      if (fallbackUpsert.error) {
        return { ok: false, partial: partialFailure, syncedCount: 0 };
      }
    }
  }

  return {
    ok: true,
    partial: partialFailure,
    syncedCount: eventRows.length,
    statePatch: {
      sourceSelectionInitialized: true
    }
  };
}
