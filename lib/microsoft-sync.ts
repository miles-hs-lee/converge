import { createAdminClient } from "@/lib/supabase/admin";

type GraphDateTimeField = {
  dateTime?: string;
  timeZone?: string;
};

type GraphCalendar = {
  id?: string;
  name?: string;
  color?: string;
  isDefaultCalendar?: boolean;
};

type GraphCalendarListResponse = {
  value?: GraphCalendar[];
};

type GraphEvent = {
  id?: string;
  "@removed"?: {
    reason?: string;
  };
  subject?: string;
  bodyPreview?: string;
  importance?: string;
  sensitivity?: string;
  categories?: string[];
  type?: string;
  start?: GraphDateTimeField;
  end?: GraphDateTimeField;
  originalStartTimeZone?: string;
  originalEndTimeZone?: string;
  isAllDay?: boolean;
  isCancelled?: boolean;
  isOnlineMeeting?: boolean;
  onlineMeeting?: {
    joinUrl?: string;
  };
  location?: {
    displayName?: string;
  };
  organizer?: {
    emailAddress?: {
      name?: string;
      address?: string;
    };
  };
  attendees?: Array<{
    type?: string;
    status?: {
      response?: string;
      time?: string;
    };
    emailAddress?: {
      name?: string;
      address?: string;
    };
  }>;
  webLink?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  showAs?: string;
  responseStatus?: {
    response?: string;
    time?: string;
  };
  recurrence?: Record<string, unknown>;
};

type GraphCalendarEventsResponse = {
  value?: GraphEvent[];
};

type GraphCalendarDeltaResponse = {
  value?: GraphEvent[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
};

type GraphUser = {
  id?: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  mail?: string;
  userPrincipalName?: string;
  jobTitle?: string;
  department?: string;
  companyName?: string;
  employeeId?: string;
  city?: string;
  state?: string;
  country?: string;
  preferredLanguage?: string;
  userType?: string;
  accountEnabled?: boolean;
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

function upsertPeopleFallbackRows(row: Record<string, unknown>): Record<string, unknown> {
  return {
    connection_id: row.connection_id,
    external_person_id: row.external_person_id,
    display_name: row.display_name,
    mail: row.mail,
    job_title: row.job_title,
    department: row.department,
    office_location: row.office_location,
    mobile_phone: row.mobile_phone,
    business_phones: row.business_phones,
    manager_external_id: row.manager_external_id,
    raw: row.raw,
    synced_at: row.synced_at
  };
}

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

async function fetchGraphJson<T>(
  url: string,
  accessToken: string,
  opts?: { prefer?: string }
): Promise<{ ok: boolean; status: number; data?: T }> {
  const prefer = opts?.prefer ?? 'outlook.timezone="UTC"';
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: prefer
    }
  });

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  const data = (await response.json()) as T;
  return { ok: true, status: response.status, data };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseDeltaByCalendar(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) {
    return {};
  }

  const map: Record<string, string> = {};
  Object.entries(raw).forEach(([calendarId, link]) => {
    if (typeof link === "string" && link.length > 0) {
      map[calendarId] = link;
    }
  });
  return map;
}

function parseIsoDate(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) {
    return null;
  }
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) {
    return null;
  }
  return new Date(ts).toISOString();
}

function buildCalendarDeltaUrl(params: { calendarId: string; fromIso: string; toIso: string }) {
  const query = new URLSearchParams({
    startDateTime: params.fromIso,
    endDateTime: params.toIso,
    $select:
      "id,subject,bodyPreview,importance,sensitivity,categories,type,start,end,originalStartTimeZone,originalEndTimeZone,isAllDay,isCancelled,isOnlineMeeting,onlineMeeting,location,organizer,attendees,webLink,createdDateTime,lastModifiedDateTime,showAs,responseStatus,recurrence"
  });
  return `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(params.calendarId)}/calendarView/delta?${query.toString()}`;
}

function chunkValues<T>(values: T[], size: number): T[][] {
  if (size <= 0) {
    return [values];
  }

  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

export async function syncMicrosoftCalendarSnapshot(params: {
  accessToken: string;
  accountEmail: string;
  connectionId: string;
  calendarState?: Record<string, unknown>;
  maxDeltaPagesPerCalendar?: number;
  adminClient: ReturnType<typeof createAdminClient>;
}): Promise<SyncResult> {
  const { accessToken, accountEmail, connectionId, calendarState, maxDeltaPagesPerCalendar, adminClient } = params;

  const currentCalendarState = isRecord(calendarState) ? calendarState : {};
  const nowTs = Date.now();
  const defaultFromIso = new Date(nowTs - 1000 * 60 * 60 * 24 * 14).toISOString();
  const defaultToIso = new Date(nowTs + 1000 * 60 * 60 * 24 * 21).toISOString();
  const previousWindowStart = parseIsoDate(currentCalendarState.windowStart);
  const previousWindowEnd = parseIsoDate(currentCalendarState.windowEnd);
  const desiredFromTs = Date.parse(defaultFromIso);
  const desiredToTs = Date.parse(defaultToIso);
  const previousFromTs = previousWindowStart ? Date.parse(previousWindowStart) : NaN;
  const previousToTs = previousWindowEnd ? Date.parse(previousWindowEnd) : NaN;
  const windowOutdated =
    !Number.isFinite(previousFromTs) ||
    !Number.isFinite(previousToTs) ||
    previousToTs < desiredToTs - 1000 * 60 * 60 * 6 ||
    previousFromTs > desiredFromTs + 1000 * 60 * 60 * 6;

  const fromIso = windowOutdated ? defaultFromIso : previousWindowStart!;
  const toIsoDate = windowOutdated ? defaultToIso : previousWindowEnd!;
  const previousDeltaByCalendar = windowOutdated ? {} : parseDeltaByCalendar(currentCalendarState.deltaByCalendar);

  const calendarsResponse = await fetchGraphJson<GraphCalendarListResponse>(
    "https://graph.microsoft.com/v1.0/me/calendars?$top=8&$select=id,name,color,isDefaultCalendar",
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
  const sourceSelectionInitialized = Boolean(currentCalendarState.sourceSelectionInitialized);
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

  const sourceRows = calendars.map((calendar) => {
    const defaultSelected = Boolean(calendar.isDefaultCalendar);
    const existingSelected = existingSelectedByExternalId.get(calendar.id!);
    const isSelected = sourceSelectionInitialized ? (existingSelected ?? defaultSelected) : defaultSelected;
    return {
      connection_id: connectionId,
      external_calendar_id: calendar.id!,
      name: calendar.name ?? "Calendar",
      color: calendar.color ?? "#0284c7",
      is_selected: isSelected,
      last_synced_at: nowIso
    };
  });
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

  const eventRows: Array<Record<string, unknown>> = [];
  const deletedExternalEventIds = new Set<string>();
  const nextDeltaByCalendar: Record<string, string> = { ...previousDeltaByCalendar };
  const deltaPageGuardLimitRaw = typeof maxDeltaPagesPerCalendar === "number" ? maxDeltaPagesPerCalendar : NaN;
  const deltaPageGuardLimit = Number.isFinite(deltaPageGuardLimitRaw) && deltaPageGuardLimitRaw > 0 ? Math.floor(deltaPageGuardLimitRaw) : 60;
  let partialFailure = false;

  for (const calendar of calendars) {
    const sourceId = sourceByExternalId.get(calendar.id!);
    if (!sourceId) {
      partialFailure = true;
      continue;
    }

    const previousDeltaLink = previousDeltaByCalendar[calendar.id!];
    let requestUrl =
      previousDeltaLink && previousDeltaLink.length > 0
        ? previousDeltaLink
        : buildCalendarDeltaUrl({ calendarId: calendar.id!, fromIso, toIso: toIsoDate });
    let latestCursor: string | null = null;
    let calendarFailed = false;
    let retriedWithFreshDelta = false;
    let guard = 0;

    while (requestUrl && guard < deltaPageGuardLimit) {
      guard += 1;
      const deltaResponse = await fetchGraphJson<GraphCalendarDeltaResponse>(requestUrl, accessToken, {
        prefer: 'outlook.timezone="UTC", odata.maxpagesize=120'
      });

      if (!deltaResponse.ok) {
        const shouldResetDelta =
          !retriedWithFreshDelta &&
          Boolean(previousDeltaLink) &&
          (deltaResponse.status === 404 || deltaResponse.status === 410 || deltaResponse.status === 412);

        if (shouldResetDelta) {
          retriedWithFreshDelta = true;
          requestUrl = buildCalendarDeltaUrl({ calendarId: calendar.id!, fromIso, toIso: toIsoDate });
          latestCursor = null;
          continue;
        }

        calendarFailed = true;
        break;
      }

      const payload = deltaResponse.data ?? {};
      const events = payload.value ?? [];
      events.forEach((event) => {
        if (!event.id) {
          return;
        }

        const externalEventId = `${calendar.id}:${event.id}`;
        if (event["@removed"] || event.showAs === "free") {
          deletedExternalEventIds.add(externalEventId);
          return;
        }

        const startAt = toIso(event.start);
        if (!startAt) {
          return;
        }
        const isAllDay = Boolean(event.isAllDay);
        const endAt = toIso(event.end) ?? fallbackEnd(startAt, isAllDay);
        const attendees = (event.attendees ?? [])
          .map((attendee) => ({
            email: attendee.emailAddress?.address ?? null,
            name: attendee.emailAddress?.name ?? null,
            type: attendee.type ?? null,
            response: attendee.status?.response ?? null,
            respondedAt: attendee.status?.time ?? null
          }))
          .filter((attendee) => Boolean(attendee.email || attendee.name));

        const organizerEmail = event.organizer?.emailAddress?.address ?? accountEmail;
        const organizerName = event.organizer?.emailAddress?.name ?? null;

        const responseStatus = event.responseStatus?.response ?? null;
        const responseTimeRaw = event.responseStatus?.time;
        const responseTime = responseTimeRaw && Number.isFinite(new Date(responseTimeRaw).getTime()) ? new Date(responseTimeRaw).toISOString() : null;
        const createdTimeRaw = event.createdDateTime;
        const createdExternal = createdTimeRaw && Number.isFinite(new Date(createdTimeRaw).getTime()) ? new Date(createdTimeRaw).toISOString() : null;
        const lastModifiedRaw = event.lastModifiedDateTime;
        const lastModifiedExternal = lastModifiedRaw && Number.isFinite(new Date(lastModifiedRaw).getTime()) ? new Date(lastModifiedRaw).toISOString() : null;

        eventRows.push({
          connection_id: connectionId,
          calendar_source_id: sourceId,
          external_event_id: externalEventId,
          subject: event.subject ?? "(제목 없음)",
          body_preview: event.bodyPreview ?? null,
          importance: event.importance ?? null,
          sensitivity: event.sensitivity ?? null,
          categories: event.categories ?? [],
          event_type: event.type ?? null,
          start_at: startAt,
          end_at: endAt,
          timezone_start: event.originalStartTimeZone ?? event.start?.timeZone ?? null,
          timezone_end: event.originalEndTimeZone ?? event.end?.timeZone ?? null,
          is_all_day: isAllDay,
          is_cancelled: Boolean(event.isCancelled),
          is_online_meeting: Boolean(event.isOnlineMeeting),
          online_meeting_url: event.onlineMeeting?.joinUrl ?? null,
          show_as: event.showAs ?? null,
          response_status: responseStatus,
          response_time: responseTime,
          location: event.location?.displayName ?? null,
          organizer: organizerEmail,
          organizer_name: organizerName,
          attendees,
          web_link: event.webLink ?? null,
          created_external: createdExternal,
          last_modified_external: lastModifiedExternal,
          recurrence: event.recurrence ?? {},
          raw: event,
          synced_at: nowIso
        });
      });

      if (typeof payload["@odata.nextLink"] === "string" && payload["@odata.nextLink"].length > 0) {
        requestUrl = payload["@odata.nextLink"];
        latestCursor = requestUrl;
      } else {
        requestUrl = "";
        if (typeof payload["@odata.deltaLink"] === "string" && payload["@odata.deltaLink"].length > 0) {
          latestCursor = payload["@odata.deltaLink"];
        }
      }
    }

    if (requestUrl && guard >= deltaPageGuardLimit) {
      partialFailure = true;
    }

    if (calendarFailed) {
      partialFailure = true;
      continue;
    }

    if (latestCursor) {
      nextDeltaByCalendar[calendar.id!] = latestCursor;
    } else if (!previousDeltaLink) {
      partialFailure = true;
    }
  }

  const deleteIds = [...deletedExternalEventIds];
  if (deleteIds.length > 0) {
    for (const chunk of chunkValues(deleteIds, 400)) {
      const deleteResult = await adminClient.from("calendar_events_cache").delete().eq("connection_id", connectionId).in("external_event_id", chunk);
      if (deleteResult.error) {
        partialFailure = true;
      }
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

  return {
    ok: true,
    partial: partialFailure,
    syncedCount: eventRows.length + deleteIds.length,
    statePatch: {
      deltaByCalendar: nextDeltaByCalendar,
      windowStart: fromIso,
      windowEnd: toIsoDate,
      sourceSelectionInitialized: true
    }
  };
}

export async function syncMicrosoftPeopleSnapshot(params: {
  accessToken: string;
  connectionId: string;
  adminClient: ReturnType<typeof createAdminClient>;
}): Promise<SyncResult> {
  const { accessToken, connectionId, adminClient } = params;

  const MAX_PEOPLE_ROWS = 5000;
  const MAX_PAGES = 20;
  const rows: Array<Record<string, unknown>> = [];
  const nowIso = new Date().toISOString();
  let partial = false;
  let nextUrl: string | null =
    "https://graph.microsoft.com/v1.0/users?$top=999&$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,companyName,employeeId,city,state,country,preferredLanguage,userType,accountEnabled,officeLocation,mobilePhone,businessPhones";
  let pageCount = 0;

  while (nextUrl && rows.length < MAX_PEOPLE_ROWS && pageCount < MAX_PAGES) {
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
        given_name: person.givenName ?? null,
        surname: person.surname ?? null,
        user_principal_name: person.userPrincipalName ?? null,
        mail: person.mail ?? person.userPrincipalName ?? null,
        job_title: person.jobTitle ?? null,
        department: person.department ?? null,
        company_name: person.companyName ?? null,
        employee_id: person.employeeId ?? null,
        preferred_language: person.preferredLanguage ?? null,
        city: person.city ?? null,
        state: person.state ?? null,
        country: person.country ?? null,
        user_type: person.userType ?? null,
        account_enabled: typeof person.accountEnabled === "boolean" ? person.accountEnabled : null,
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

  if (nextUrl) {
    partial = true;
  }

  if (rows.length === 0) {
    const meResponse = await fetchGraphJson<GraphUser>(
      "https://graph.microsoft.com/v1.0/me?$select=id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department,companyName,employeeId,city,state,country,preferredLanguage,userType,accountEnabled,officeLocation,mobilePhone,businessPhones",
      accessToken
    );
    if (!meResponse.ok || !meResponse.data?.id || !meResponse.data?.displayName) {
      return { ok: false, partial: false, syncedCount: 0 };
    }

    rows.push({
      connection_id: connectionId,
      external_person_id: meResponse.data.id,
      display_name: meResponse.data.displayName,
      given_name: meResponse.data.givenName ?? null,
      surname: meResponse.data.surname ?? null,
      user_principal_name: meResponse.data.userPrincipalName ?? null,
      mail: meResponse.data.mail ?? meResponse.data.userPrincipalName ?? null,
      job_title: meResponse.data.jobTitle ?? null,
      department: meResponse.data.department ?? null,
      company_name: meResponse.data.companyName ?? null,
      employee_id: meResponse.data.employeeId ?? null,
      preferred_language: meResponse.data.preferredLanguage ?? null,
      city: meResponse.data.city ?? null,
      state: meResponse.data.state ?? null,
      country: meResponse.data.country ?? null,
      user_type: meResponse.data.userType ?? null,
      account_enabled: typeof meResponse.data.accountEnabled === "boolean" ? meResponse.data.accountEnabled : null,
      office_location: meResponse.data.officeLocation ?? null,
      mobile_phone: meResponse.data.mobilePhone ?? null,
      business_phones: meResponse.data.businessPhones ?? [],
      manager_external_id: null,
      raw: meResponse.data,
      synced_at: nowIso
    });
  }

  const peopleUpsert = await adminClient.from("people_cache").upsert(rows, { onConflict: "connection_id,external_person_id" });

  if (peopleUpsert.error) {
    const fallbackRows = rows.map(upsertPeopleFallbackRows);
    const fallbackUpsert = await adminClient.from("people_cache").upsert(fallbackRows, { onConflict: "connection_id,external_person_id" });
    if (fallbackUpsert.error) {
      return { ok: false, partial, syncedCount: 0 };
    }
  }

  return { ok: true, partial, syncedCount: rows.length };
}
