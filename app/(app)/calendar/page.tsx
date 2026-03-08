import { isMockMode } from "@/lib/mock-mode";
import { mockCalendarEvents, mockConnections } from "@/lib/mock-data";
import { CalendarPageClient } from "@/components/calendar-page-client";
import {
  type CalendarAttendee,
  type CalendarEventRow,
  type CalendarSourceRow
} from "@/components/calendar-events-overview";
import { CalendarEntrySync } from "@/components/calendar-entry-sync";
import { getServerLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { buildCalendarWindow } from "@/lib/calendar-window";
import { fetchCalendarWindowData } from "@/lib/data/calendar-data";

function parseAttendeeEmails(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
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
    .filter((item): item is CalendarAttendee => Boolean(item?.email))
    .map((attendee) => attendee.email);
}

export default async function CalendarPage() {
  const locale = await getServerLocale({ dbFallback: true });
  const tt = (key: Parameters<typeof t>[1], vars?: Parameters<typeof t>[2]) => t(locale, key, vars);

  let events: CalendarEventRow[] = [];
  let tenants: string[] = [];
  let calendarSources: CalendarSourceRow[] = [];
  let shouldTriggerEntrySync = false;

  if (isMockMode) {
    events = mockCalendarEvents;
    tenants = [...new Set(mockConnections.map((connection) => connection.tenantName))];
  } else {
    shouldTriggerEntrySync = true;

    const { fromIso: from, toIso: to } = buildCalendarWindow();
    const eventSelectSummary =
      "id,subject,start_at,end_at,is_all_day,location,connection_id,organizer,attendees,calendar_source_id,show_as,response_status,is_cancelled";
    const eventSelectFallback = "id,subject,start_at,end_at,is_all_day,location,connection_id,organizer,attendees,calendar_source_id";
    const { connections, sourceRows, eventRows } = await fetchCalendarWindowData({
      fromIso: from,
      toIso: to,
      eventSelectSummary,
      eventSelectFallback,
      eventLimit: 500
    });

    const tenantByConnection = new Map<string, string>();
    const accountByConnection = new Map<string, string>();
    const providerByConnection = new Map<string, string>();
    const sourceNameById = new Map<string, string>();
    (sourceRows ?? []).forEach((source) => {
      sourceNameById.set(source.id, source.name);
    });
    (connections ?? []).forEach((connection) => {
      tenantByConnection.set(connection.id, connection.tenant_name ?? "Connected Account");
      accountByConnection.set(connection.id, connection.m365_user_principal_name ?? "unknown@account");
      providerByConnection.set(connection.id, connection.provider ?? "microsoft");
    });
    calendarSources = (sourceRows ?? []).map((source) => ({
      id: source.id,
      name: source.name,
      tenantName: tenantByConnection.get(source.connection_id) ?? "Connected Account",
      provider: providerByConnection.get(source.connection_id) ?? "microsoft",
      isSelected: Boolean(source.is_selected)
    }));

    events = eventRows.map((event) => {
      const attendeeEmails = parseAttendeeEmails(event.attendees);
      return {
        id: event.id,
        calendarSourceId: "calendar_source_id" in event && typeof event.calendar_source_id === "string" ? event.calendar_source_id : undefined,
        tenantName: tenantByConnection.get(event.connection_id) ?? "Connected Account",
        subject: event.subject ?? tt("common.untitled"),
        startAt: event.start_at,
        endAt: event.end_at,
        location: event.location ?? tt("common.locationUnknown"),
        sourceAccount: accountByConnection.get(event.connection_id) ?? event.organizer ?? tt("common.unknownAccount"),
        attendees: attendeeEmails,
        attendeeDetails: undefined,
        organizer: event.organizer ?? accountByConnection.get(event.connection_id) ?? tt("common.unknownAccount"),
        organizerName: null,
        isAllDay: Boolean(event.is_all_day),
        webLink: null,
        lastModifiedAt: null,
        createdAt: null,
        calendarName: sourceNameById.get(event.calendar_source_id) ?? "Calendar",
        provider: providerByConnection.get(event.connection_id) ?? "microsoft",
        bodyPreview: null,
        importance: null,
        sensitivity: null,
        showAs: "show_as" in event && typeof event.show_as === "string" ? event.show_as : null,
        responseStatus: "response_status" in event && typeof event.response_status === "string" ? event.response_status : null,
        responseTime: null,
        isCancelled: "is_cancelled" in event ? Boolean(event.is_cancelled) : false,
        isOnlineMeeting: false,
        onlineMeetingUrl: null,
        eventType: null,
        categories: [],
        timezoneStart: null,
        timezoneEnd: null,
        detailLoaded: false
      };
    });

    tenants = [...new Set((connections ?? []).map((connection) => connection.tenant_name ?? "Connected Account"))];
  }

  return (
    <div className="space-y-4">
      <CalendarEntrySync enabled={shouldTriggerEntrySync} />
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
        <CalendarPageClient calendarSources={calendarSources} events={events} tenants={tenants} />
      </section>
    </div>
  );
}
