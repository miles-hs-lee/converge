import { isMockMode } from "@/lib/mock-mode";
import { mockCalendarEvents, mockConnections } from "@/lib/mock-data";
import type { CalendarEventRow } from "@/components/calendar-events-overview";
import { AlertsOverviewShell } from "@/components/alerts-overview-shell";
import { detectTenantConflicts } from "@/lib/calendar-conflicts";
import { getServerLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { buildCalendarWindow } from "@/lib/calendar-window";
import { fetchCalendarWindowData } from "@/lib/data/calendar-data";

export default async function AlertsPage() {
  const locale = await getServerLocale({ dbFallback: true });
  const tt = (key: Parameters<typeof t>[1], vars?: Parameters<typeof t>[2]) => t(locale, key, vars);

  let events: CalendarEventRow[] = [];
  let tenants: string[] = [];
  const nowIso = new Date().toISOString();

  if (isMockMode) {
    events = mockCalendarEvents;
    tenants = [...new Set(mockConnections.map((connection) => connection.tenantName))];
  } else {
    const { fromIso: from, toIso: to } = buildCalendarWindow();

    const eventSelectSummary = "id,subject,start_at,end_at,is_all_day,location,connection_id,organizer,calendar_source_id";
    const eventSelectFallback = "id,subject,start_at,end_at,location,connection_id,organizer,calendar_source_id";
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

    events = eventRows.map((event) => {
      return {
        id: event.id,
        calendarSourceId: "calendar_source_id" in event && typeof event.calendar_source_id === "string" ? event.calendar_source_id : undefined,
        tenantName: tenantByConnection.get(event.connection_id) ?? "Connected Account",
        subject: event.subject ?? tt("common.untitled"),
        startAt: event.start_at,
        endAt: event.end_at,
        location: event.location ?? tt("common.locationUnknown"),
        sourceAccount: accountByConnection.get(event.connection_id) ?? event.organizer ?? tt("common.unknownAccount"),
        attendees: [],
        attendeeDetails: [],
        organizer: event.organizer ?? accountByConnection.get(event.connection_id) ?? tt("common.unknownAccount"),
        organizerName: null,
        isAllDay: "is_all_day" in event ? Boolean(event.is_all_day) : false,
        webLink: null,
        lastModifiedAt: null,
        createdAt: null,
        calendarName: sourceNameById.get(event.calendar_source_id) ?? "Calendar",
        provider: providerByConnection.get(event.connection_id) ?? "microsoft",
        bodyPreview: null,
        importance: null,
        sensitivity: null,
        showAs: null,
        responseStatus: null,
        responseTime: null,
        isCancelled: false,
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

  const initialConflicts = detectTenantConflicts(
    events.map((event) => ({
      id: event.id,
      tenantName: event.tenantName,
      subject: event.subject,
      startAt: event.startAt,
      endAt: event.endAt,
      location: event.location,
      sourceAccount: event.sourceAccount
    }))
  ).filter((conflict) => conflict.overlapEnd >= nowIso);

  return (
    <div className="space-y-4">
      <section className="panel-glass card p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="title-xl">{tt("alerts.title")}</h1>
            <p className="muted mt-1">{tt("alerts.subtitle")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="surface-chip">{tt("calendar.connectedTenants", { count: tenants.length })}</span>
            <span className="surface-chip">{tt("calendar.visibleEvents", { count: events.length })}</span>
          </div>
        </div>
      </section>

      <section className="panel-glass card p-5 md:p-6">
        <AlertsOverviewShell events={events} initialConflicts={initialConflicts} tenants={tenants} />
      </section>
    </div>
  );
}
