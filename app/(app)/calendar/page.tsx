import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/mock-mode";
import { mockCalendarEvents, mockConnections } from "@/lib/mock-data";
import { CalendarEventsOverview, type CalendarAttendee, type CalendarEventRow } from "@/components/calendar-events-overview";
import { getServerLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { syncUserConnections } from "@/lib/connection-sync";

function resolveAutoSyncStaleMs(): number {
  const rawMinutes = process.env.CALENDAR_AUTO_SYNC_STALE_MINUTES;
  const minutes = rawMinutes ? Number(rawMinutes) : 5;
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return 1000 * 60 * 5;
  }
  return Math.floor(minutes * 60 * 1000);
}

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

  const attendeeEmails = attendeeDetails.map((attendee) => attendee.email);
  return { attendeeEmails, attendeeDetails };
}

export default async function CalendarPage() {
  const locale = await getServerLocale();
  const tt = (key: Parameters<typeof t>[1], vars?: Parameters<typeof t>[2]) => t(locale, key, vars);

  let events: CalendarEventRow[] = [];
  let tenants: string[] = [];

  if (isMockMode) {
    events = mockCalendarEvents;
    tenants = [...new Set(mockConnections.map((connection) => connection.tenantName))];
  } else {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      // On calendar page entry, run delta sync only when stale to keep UI fresh.
      try {
        await syncUserConnections({
          userId: user.id,
          mode: "calendar",
          calendarStaleMs: resolveAutoSyncStaleMs()
        });
      } catch {
        // Rendering should continue even if sync fails.
      }

      const now = Date.now();
      const from = new Date(now - 1000 * 60 * 60 * 24 * 14).toISOString();
      const to = new Date(now + 1000 * 60 * 60 * 24 * 21).toISOString();

      const { data: connections } = await supabase
        .from("m365_connections")
        .select("id,provider,tenant_name,m365_user_principal_name")
        .order("created_at", { ascending: true });

      const connectionIds = (connections ?? []).map((connection) => connection.id);
      const { data: sources } =
        connectionIds.length === 0
          ? { data: [] as Array<{ id: string; name: string }> }
          : await supabase.from("calendar_sources").select("id,name").in("connection_id", connectionIds);

      const eventSelectExpanded =
        "id,subject,start_at,end_at,is_all_day,location,connection_id,organizer,organizer_name,attendees,web_link,last_modified_external,created_external,calendar_source_id,body_preview,importance,sensitivity,show_as,response_status,response_time,is_cancelled,is_online_meeting,online_meeting_url,event_type,categories,timezone_start,timezone_end";
      const eventSelectFallback = "id,subject,start_at,end_at,is_all_day,location,connection_id,organizer,attendees,web_link,last_modified_external,calendar_source_id";
      const queryEvents = (selectText: string) => {
        let query = supabase
          .from("calendar_events_cache")
          .select(selectText)
          .gte("start_at", from)
          .lte("start_at", to)
          .order("start_at", { ascending: true })
          .limit(120);

        if (connectionIds.length > 0) {
          query = query.in("connection_id", connectionIds);
        }
        return query;
      };
      const expandedResult = connectionIds.length === 0 ? { data: [] as Array<Record<string, any>>, error: null } : await queryEvents(eventSelectExpanded);
      const { data: dbEvents } = expandedResult.error ? await queryEvents(eventSelectFallback) : expandedResult;

      const tenantByConnection = new Map<string, string>();
      const accountByConnection = new Map<string, string>();
      const providerByConnection = new Map<string, string>();
      const sourceNameById = new Map<string, string>();
      (sources ?? []).forEach((source) => {
        sourceNameById.set(source.id, source.name);
      });
      (connections ?? []).forEach((connection) => {
        tenantByConnection.set(connection.id, connection.tenant_name ?? "Connected Tenant");
        accountByConnection.set(connection.id, connection.m365_user_principal_name ?? "unknown@account");
        providerByConnection.set(connection.id, connection.provider ?? "microsoft");
      });

      events = ((dbEvents ?? []) as Array<Record<string, any>>).map((event) => {
        const { attendeeEmails, attendeeDetails } = parseAttendeeData(event.attendees);
        return {
        id: event.id,
        tenantName: tenantByConnection.get(event.connection_id) ?? "Connected Tenant",
        subject: event.subject ?? tt("common.untitled"),
        startAt: event.start_at,
        endAt: event.end_at,
        location: event.location ?? tt("common.locationUnknown"),
        sourceAccount: accountByConnection.get(event.connection_id) ?? event.organizer ?? tt("common.unknownAccount"),
        attendees: attendeeEmails,
        attendeeDetails,
        organizer: event.organizer ?? accountByConnection.get(event.connection_id) ?? tt("common.unknownAccount"),
        organizerName: "organizer_name" in event && typeof event.organizer_name === "string" ? event.organizer_name : null,
        isAllDay: Boolean(event.is_all_day),
        webLink: event.web_link ?? null,
        lastModifiedAt: event.last_modified_external ?? null,
        createdAt: "created_external" in event && typeof event.created_external === "string" ? event.created_external : null,
        calendarName: sourceNameById.get(event.calendar_source_id) ?? "Calendar",
        provider: providerByConnection.get(event.connection_id) ?? "microsoft",
        bodyPreview: "body_preview" in event && typeof event.body_preview === "string" ? event.body_preview : null,
        importance: "importance" in event && typeof event.importance === "string" ? event.importance : null,
        sensitivity: "sensitivity" in event && typeof event.sensitivity === "string" ? event.sensitivity : null,
        showAs: "show_as" in event && typeof event.show_as === "string" ? event.show_as : null,
        responseStatus: "response_status" in event && typeof event.response_status === "string" ? event.response_status : null,
        responseTime: "response_time" in event && typeof event.response_time === "string" ? event.response_time : null,
        isCancelled: "is_cancelled" in event ? Boolean(event.is_cancelled) : false,
        isOnlineMeeting: "is_online_meeting" in event ? Boolean(event.is_online_meeting) : false,
        onlineMeetingUrl: "online_meeting_url" in event && typeof event.online_meeting_url === "string" ? event.online_meeting_url : null,
        eventType: "event_type" in event && typeof event.event_type === "string" ? event.event_type : null,
        categories: "categories" in event && Array.isArray(event.categories) ? event.categories.filter((v: unknown): v is string => typeof v === "string") : [],
        timezoneStart: "timezone_start" in event && typeof event.timezone_start === "string" ? event.timezone_start : null,
        timezoneEnd: "timezone_end" in event && typeof event.timezone_end === "string" ? event.timezone_end : null
      };
      });

      tenants = [...new Set((connections ?? []).map((connection) => connection.tenant_name ?? "Connected Tenant"))];
    }
  }

  return (
    <div className="space-y-4">
      <section className="panel-glass card p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="title-xl">{tt("calendar.title")}</h1>
            <p className="muted mt-1">{tt("calendar.subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="surface-chip">{tt("calendar.connectedTenants", { count: tenants.length })}</span>
            <span className="surface-chip">{tt("calendar.visibleEvents", { count: events.length })}</span>
          </div>
        </div>
      </section>

      <section className="panel-glass card p-5 md:p-6">
        <CalendarEventsOverview events={events} tenants={tenants} />
      </section>
    </div>
  );
}
