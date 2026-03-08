import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CalendarAttendee = {
  email: string;
  name?: string | null;
  type?: string | null;
  response?: string | null;
  respondedAt?: string | null;
};

function parseAttendeeData(raw: unknown): { attendeeEmails: string[]; attendeeDetails: CalendarAttendee[] } {
  if (!Array.isArray(raw)) {
    return { attendeeEmails: [], attendeeDetails: [] };
  }

  const attendeeDetails = raw
    .map((item): CalendarAttendee | null => {
      if (typeof item === "string") {
        return { email: item };
      }
      if (typeof item === "object" && item && "emailAddress" in item) {
        const attendee = item as {
          type?: string;
          status?: { response?: string; time?: string };
          emailAddress?: { address?: string; name?: string };
        };
        const address = attendee.emailAddress?.address;
        if (!address) return null;
        return {
          email: address,
          name: attendee.emailAddress?.name ?? null,
          type: attendee.type ?? null,
          response: attendee.status?.response ?? null,
          respondedAt: attendee.status?.time ?? null
        };
      }
      if (typeof item === "object" && item) {
        const attendee = item as {
          email?: string;
          name?: string;
          type?: string;
          response?: string;
          respondedAt?: string;
        };
        if (!attendee.email) return null;
        return {
          email: attendee.email,
          name: attendee.name ?? null,
          type: attendee.type ?? null,
          response: attendee.response ?? null,
          respondedAt: attendee.respondedAt ?? null
        };
      }
      return null;
    })
    .filter((item): item is CalendarAttendee => Boolean(item?.email));

  return { attendeeEmails: attendeeDetails.map((attendee) => attendee.email), attendeeDetails };
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const eventId = (new URL(request.url).searchParams.get("id") ?? "").trim();
  if (!eventId) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }

  const eventSelectExpanded =
    "id,subject,start_at,end_at,is_all_day,location,connection_id,organizer,organizer_name,attendees,web_link,last_modified_external,created_external,calendar_source_id,body_preview,importance,sensitivity,show_as,response_status,response_time,is_cancelled,is_online_meeting,online_meeting_url,event_type,categories,timezone_start,timezone_end";
  const eventSelectFallback = "id,subject,start_at,end_at,is_all_day,location,connection_id,organizer,attendees,web_link,last_modified_external,calendar_source_id";
  const queryEvent = (selectText: string) =>
    supabase
      .from("calendar_events_cache")
      .select(selectText)
      .eq("id", eventId)
      .maybeSingle();

  const primary = await queryEvent(eventSelectExpanded);
  const { data: dbEvent, error } = primary.error ? await queryEvent(eventSelectFallback) : primary;

  if (error || !dbEvent) {
    return NextResponse.json({ ok: false, error: "event_not_found" }, { status: 404 });
  }

  const eventRow = dbEvent as Record<string, any>;

  const { data: connection } = await supabase
    .from("m365_connections")
    .select("id,provider,tenant_name,m365_user_principal_name")
    .eq("id", eventRow.connection_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ ok: false, error: "event_not_found" }, { status: 404 });
  }

  const { data: source } = await supabase
    .from("calendar_sources")
    .select("name")
    .eq("id", eventRow.calendar_source_id)
    .maybeSingle();

  const { attendeeEmails, attendeeDetails } = parseAttendeeData(eventRow.attendees);
  const item = {
    id: eventRow.id,
    calendarSourceId: typeof eventRow.calendar_source_id === "string" ? eventRow.calendar_source_id : undefined,
    tenantName: connection.tenant_name ?? "Connected Account",
    subject: eventRow.subject ?? "(Untitled)",
    startAt: eventRow.start_at,
    endAt: eventRow.end_at,
    location: eventRow.location ?? "Unspecified",
    sourceAccount: connection.m365_user_principal_name ?? eventRow.organizer ?? "unknown@account",
    attendees: attendeeEmails,
    attendeeDetails,
    organizer: eventRow.organizer ?? connection.m365_user_principal_name ?? "unknown@account",
    organizerName: typeof eventRow.organizer_name === "string" ? eventRow.organizer_name : null,
    isAllDay: Boolean(eventRow.is_all_day),
    webLink: eventRow.web_link ?? null,
    lastModifiedAt: eventRow.last_modified_external ?? null,
    createdAt: typeof eventRow.created_external === "string" ? eventRow.created_external : null,
    calendarName: source?.name ?? "Calendar",
    provider: connection.provider ?? "microsoft",
    bodyPreview: typeof eventRow.body_preview === "string" ? eventRow.body_preview : null,
    importance: typeof eventRow.importance === "string" ? eventRow.importance : null,
    sensitivity: typeof eventRow.sensitivity === "string" ? eventRow.sensitivity : null,
    showAs: typeof eventRow.show_as === "string" ? eventRow.show_as : null,
    responseStatus: typeof eventRow.response_status === "string" ? eventRow.response_status : null,
    responseTime: typeof eventRow.response_time === "string" ? eventRow.response_time : null,
    isCancelled: Boolean(eventRow.is_cancelled),
    isOnlineMeeting: Boolean(eventRow.is_online_meeting),
    onlineMeetingUrl: typeof eventRow.online_meeting_url === "string" ? eventRow.online_meeting_url : null,
    eventType: typeof eventRow.event_type === "string" ? eventRow.event_type : null,
    categories: Array.isArray(eventRow.categories) ? eventRow.categories.filter((v: unknown): v is string => typeof v === "string") : [],
    timezoneStart: typeof eventRow.timezone_start === "string" ? eventRow.timezone_start : null,
    timezoneEnd: typeof eventRow.timezone_end === "string" ? eventRow.timezone_end : null,
    detailLoaded: true
  };

  return NextResponse.json(
    { ok: true, item },
    {
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=600"
      }
    }
  );
}
