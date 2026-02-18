import { createAdminClient } from "@/lib/supabase/admin";

type GraphDateTimeField = {
  dateTime?: string;
  timeZone?: string;
};

type GraphCalendar = {
  id?: string;
  name?: string;
  color?: string;
};

type GraphCalendarListResponse = {
  value?: GraphCalendar[];
};

type GraphEvent = {
  id?: string;
  subject?: string;
  start?: GraphDateTimeField;
  end?: GraphDateTimeField;
  isAllDay?: boolean;
  location?: {
    displayName?: string;
  };
  organizer?: {
    emailAddress?: {
      address?: string;
    };
  };
  attendees?: Array<{
    emailAddress?: {
      address?: string;
    };
  }>;
  webLink?: string;
  lastModifiedDateTime?: string;
  showAs?: string;
};

type GraphCalendarEventsResponse = {
  value?: GraphEvent[];
};

type GraphUser = {
  id?: string;
  displayName?: string;
  mail?: string;
  userPrincipalName?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
  businessPhones?: string[];
};

type GraphUsersResponse = {
  value?: GraphUser[];
  "@odata.nextLink"?: string;
};

type SyncResult = {
  ok: boolean;
  partial: boolean;
  syncedCount: number;
};

function toIso(dateField?: GraphDateTimeField): string | null {
  if (!dateField?.dateTime) {
    return null;
  }

  const raw = dateField.dateTime;
  const hasOffset = /(?:Z|[+-]\d{2}:\d{2})$/.test(raw);
  const timezone = (dateField.timeZone ?? "").toUpperCase();
  const candidate = hasOffset ? raw : timezone === "UTC" ? `${raw}Z` : raw;
  const parsed = new Date(candidate);

  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
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

async function fetchGraphJson<T>(url: string, accessToken: string): Promise<{ ok: boolean; data?: T }> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"'
    }
  });

  if (!response.ok) {
    return { ok: false };
  }

  const data = (await response.json()) as T;
  return { ok: true, data };
}

export async function syncMicrosoftCalendarSnapshot(params: {
  accessToken: string;
  accountEmail: string;
  connectionId: string;
  adminClient: ReturnType<typeof createAdminClient>;
}): Promise<SyncResult> {
  const { accessToken, accountEmail, connectionId, adminClient } = params;

  const calendarsResponse = await fetchGraphJson<GraphCalendarListResponse>(
    "https://graph.microsoft.com/v1.0/me/calendars?$top=8&$select=id,name,color",
    accessToken
  );
  if (!calendarsResponse.ok) {
    return { ok: false, partial: false, syncedCount: 0 };
  }

  const calendars = (calendarsResponse.data?.value ?? []).filter(
    (calendar): calendar is Required<Pick<GraphCalendar, "id">> & GraphCalendar => Boolean(calendar.id)
  );

  if (calendars.length === 0) {
    return { ok: true, partial: false, syncedCount: 0 };
  }

  const nowIso = new Date().toISOString();
  const sourceRows = calendars.map((calendar) => ({
    connection_id: connectionId,
    external_calendar_id: calendar.id!,
    name: calendar.name ?? "Calendar",
    color: calendar.color ?? "#0284c7",
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

    const params = new URLSearchParams({
      startDateTime: fromIso,
      endDateTime: toIsoDate,
      $top: "120",
      $select: "id,subject,start,end,isAllDay,location,organizer,attendees,webLink,lastModifiedDateTime,showAs"
    });

    const eventsResponse = await fetchGraphJson<GraphCalendarEventsResponse>(
      `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendar.id!)}/calendarView?${params.toString()}`,
      accessToken
    );

    if (!eventsResponse.ok) {
      partialFailure = true;
      continue;
    }

    const events = eventsResponse.data?.value ?? [];
    events.forEach((event) => {
      if (!event.id || event.showAs === "free") {
        return;
      }

      const startAt = toIso(event.start);
      if (!startAt) {
        return;
      }
      const isAllDay = Boolean(event.isAllDay);
      const endAt = toIso(event.end) ?? fallbackEnd(startAt, isAllDay);
      const attendees = (event.attendees ?? [])
        .map((attendee) => attendee.emailAddress?.address)
        .filter((email): email is string => Boolean(email));

      eventRows.push({
        connection_id: connectionId,
        calendar_source_id: sourceId,
        external_event_id: `${calendar.id}:${event.id}`,
        subject: event.subject ?? "(제목 없음)",
        start_at: startAt,
        end_at: endAt,
        is_all_day: isAllDay,
        location: event.location?.displayName ?? null,
        organizer: event.organizer?.emailAddress?.address ?? accountEmail,
        attendees,
        web_link: event.webLink ?? null,
        last_modified_external: event.lastModifiedDateTime ?? null,
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

export async function syncMicrosoftPeopleSnapshot(params: {
  accessToken: string;
  connectionId: string;
  adminClient: ReturnType<typeof createAdminClient>;
}): Promise<SyncResult> {
  const { accessToken, connectionId, adminClient } = params;

  const rows: Array<Record<string, unknown>> = [];
  const nowIso = new Date().toISOString();
  let partial = false;
  let nextUrl: string | null =
    "https://graph.microsoft.com/v1.0/users?$top=80&$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone,businessPhones";
  let pageCount = 0;

  while (nextUrl && rows.length < 300 && pageCount < 5) {
    const graphPage: { ok: boolean; data?: GraphUsersResponse } = await fetchGraphJson<GraphUsersResponse>(nextUrl, accessToken);
    if (!graphPage.ok) {
      if (rows.length === 0) {
        break;
      }
      partial = true;
      break;
    }

    const users: GraphUser[] = graphPage.data?.value ?? [];
    users.forEach((person) => {
      if (!person.id || !person.displayName) {
        return;
      }

      rows.push({
        connection_id: connectionId,
        external_person_id: person.id,
        display_name: person.displayName,
        mail: person.mail ?? person.userPrincipalName ?? null,
        job_title: person.jobTitle ?? null,
        department: person.department ?? null,
        office_location: person.officeLocation ?? null,
        mobile_phone: person.mobilePhone ?? null,
        business_phones: person.businessPhones ?? [],
        manager_external_id: null,
        raw: person,
        synced_at: nowIso
      });
    });

    nextUrl = graphPage.data?.["@odata.nextLink"] ?? null;
    pageCount += 1;
  }

  if (rows.length === 0) {
    const meResponse = await fetchGraphJson<GraphUser>(
      "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone,businessPhones",
      accessToken
    );
    if (!meResponse.ok || !meResponse.data?.id || !meResponse.data?.displayName) {
      return { ok: false, partial: false, syncedCount: 0 };
    }

    rows.push({
      connection_id: connectionId,
      external_person_id: meResponse.data.id,
      display_name: meResponse.data.displayName,
      mail: meResponse.data.mail ?? meResponse.data.userPrincipalName ?? null,
      job_title: meResponse.data.jobTitle ?? null,
      department: meResponse.data.department ?? null,
      office_location: meResponse.data.officeLocation ?? null,
      mobile_phone: meResponse.data.mobilePhone ?? null,
      business_phones: meResponse.data.businessPhones ?? [],
      manager_external_id: null,
      raw: meResponse.data,
      synced_at: nowIso
    });
  }

  const { error: peopleUpsertError } = await adminClient
    .from("people_cache")
    .upsert(rows, { onConflict: "connection_id,external_person_id" });

  if (peopleUpsertError) {
    return { ok: false, partial, syncedCount: 0 };
  }

  return { ok: true, partial, syncedCount: rows.length };
}
