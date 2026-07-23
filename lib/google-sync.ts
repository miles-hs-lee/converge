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
  nextPageToken?: string;
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
  nextPageToken?: string;
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

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

async function removeStaleGoogleEvents(params: {
  adminClient: ReturnType<typeof createAdminClient>;
  sourceId: string;
  fromIso: string;
  toIso: string;
  currentExternalIds: Set<string>;
}): Promise<{ ok: boolean; deletedCount: number }> {
  const { adminClient, sourceId, fromIso, toIso, currentExternalIds } = params;
  const staleRowIds: string[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await adminClient
      .from("calendar_events_cache")
      .select("id,external_event_id")
      .eq("calendar_source_id", sourceId)
      .lte("start_at", toIso)
      .gte("end_at", fromIso)
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      return { ok: false, deletedCount: 0 };
    }
    const rows = data ?? [];
    rows.forEach((row) => {
      if (!currentExternalIds.has(row.external_event_id)) {
        staleRowIds.push(row.id);
      }
    });
    if (rows.length < pageSize) {
      break;
    }
    offset += pageSize;
  }

  for (const chunk of chunkValues(staleRowIds, 400)) {
    const { error } = await adminClient.from("calendar_events_cache").delete().in("id", chunk);
    if (error) {
      return { ok: false, deletedCount: 0 };
    }
  }
  return { ok: true, deletedCount: staleRowIds.length };
}

export async function syncGoogleCalendarSnapshot(params: {
  accessToken: string;
  accountEmail: string;
  connectionId: string;
  calendarState?: Record<string, unknown>;
  adminClient: ReturnType<typeof createAdminClient>;
}): Promise<CalendarSyncResult> {
  const { accessToken, accountEmail, connectionId, calendarState, adminClient } = params;

  const calendars: Array<Required<Pick<GoogleCalendarListItem, "id">> & GoogleCalendarListItem> = [];
  const seenCalendarIds = new Set<string>();
  let calendarPageToken: string | null = null;
  let calendarPageCount = 0;
  let calendarListPartial = false;

  do {
    const query = new URLSearchParams({ maxResults: "250" });
    if (calendarPageToken) {
      query.set("pageToken", calendarPageToken);
    }
    const calendarListResponse = await fetch(`https://www.googleapis.com/calendar/v3/users/me/calendarList?${query.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!calendarListResponse.ok) {
      if (calendars.length === 0) {
        return { ok: false, partial: false, syncedCount: 0 };
      }
      calendarListPartial = true;
      break;
    }

    const calendarListData = (await calendarListResponse.json()) as GoogleCalendarListResponse;
    (calendarListData.items ?? []).forEach((calendar) => {
      if (!calendar.id || seenCalendarIds.has(calendar.id)) {
        return;
      }
      seenCalendarIds.add(calendar.id);
      calendars.push(calendar as Required<Pick<GoogleCalendarListItem, "id">> & GoogleCalendarListItem);
    });
    calendarPageToken = calendarListData.nextPageToken ?? null;
    calendarPageCount += 1;
  } while (calendarPageToken && calendarPageCount < 10);

  if (calendarPageToken) {
    calendarListPartial = true;
  }

  if (calendars.length === 0) {
    return { ok: true, partial: false, syncedCount: 0 };
  }

  const nowIso = new Date().toISOString();
  const sourceSelectionInitialized = Boolean(calendarState && calendarState.sourceSelectionInitialized);
  const { data: existingSourceData, error: existingSourceError } = await adminClient
    .from("calendar_sources")
    .select("id,external_calendar_id,is_selected")
    .eq("connection_id", connectionId);
  if (existingSourceError) {
    return { ok: false, partial: false, syncedCount: 0 };
  }
  const existingSelectedByExternalId = new Map<string, boolean>();
  (existingSourceData ?? []).forEach((row) => {
    existingSelectedByExternalId.set(row.external_calendar_id, Boolean(row.is_selected));
  });

  if (!calendarListPartial) {
    const staleSourceIds = (existingSourceData ?? [])
      .filter((row) => !seenCalendarIds.has(row.external_calendar_id))
      .map((row) => row.id);
    for (const chunk of chunkValues(staleSourceIds, 400)) {
      const staleDelete = await adminClient.from("calendar_sources").delete().in("id", chunk);
      if (staleDelete.error) {
        calendarListPartial = true;
        break;
      }
    }
  }

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
  const completedCalendarSnapshots: Array<{ sourceId: string; currentExternalIds: Set<string> }> = [];
  let partialFailure = calendarListPartial;

  for (const calendar of calendars) {
    const sourceId = sourceByExternalId.get(calendar.id!);
    if (!sourceId) {
      partialFailure = true;
      continue;
    }

    const currentExternalIds = new Set<string>();
    let eventPageToken: string | null = null;
    let eventPageCount = 0;
    let snapshotComplete = true;

    do {
      const query = new URLSearchParams({
        singleEvents: "true",
        showDeleted: "true",
        orderBy: "startTime",
        maxResults: "250",
        timeMin: fromIso,
        timeMax: toIsoDate
      });
      if (eventPageToken) {
        query.set("pageToken", eventPageToken);
      }

      const eventsResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id!)}/events?${query.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!eventsResponse.ok) {
        partialFailure = true;
        snapshotComplete = false;
        break;
      }

      const eventsData = (await eventsResponse.json()) as GoogleCalendarEventsResponse;
      (eventsData.items ?? []).forEach((event) => {
        if (!event.id) {
          return;
        }

        const externalEventId = `${calendar.id}:${event.id}`;
        if (event.status === "cancelled") {
          return;
        }
        currentExternalIds.add(externalEventId);

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
          external_event_id: externalEventId,
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
          is_cancelled: false,
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

      eventPageToken = eventsData.nextPageToken ?? null;
      eventPageCount += 1;
    } while (eventPageToken && eventPageCount < 20);

    if (eventPageToken) {
      partialFailure = true;
      snapshotComplete = false;
    }
    if (snapshotComplete) {
      completedCalendarSnapshots.push({ sourceId, currentExternalIds });
    }
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

  let deletedCount = 0;
  for (const snapshot of completedCalendarSnapshots) {
    const reconcileResult = await removeStaleGoogleEvents({
      adminClient,
      sourceId: snapshot.sourceId,
      fromIso,
      toIso: toIsoDate,
      currentExternalIds: snapshot.currentExternalIds
    });
    if (!reconcileResult.ok) {
      partialFailure = true;
      continue;
    }
    deletedCount += reconcileResult.deletedCount;
  }

  return {
    ok: true,
    partial: partialFailure,
    syncedCount: eventRows.length + deletedCount,
    statePatch: {
      sourceSelectionInitialized: true
    }
  };
}
