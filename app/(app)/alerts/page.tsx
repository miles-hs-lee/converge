import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/mock-mode";
import { mockCalendarEvents, mockConnections } from "@/lib/mock-data";
import { CalendarEventsOverview, type CalendarEventRow } from "@/components/calendar-events-overview";
import { CalendarEntrySync } from "@/components/calendar-entry-sync";
import { getServerLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export default async function AlertsPage() {
  const locale = await getServerLocale();
  const tt = (key: Parameters<typeof t>[1], vars?: Parameters<typeof t>[2]) => t(locale, key, vars);

  let events: CalendarEventRow[] = [];
  let tenants: string[] = [];
  let shouldTriggerEntrySync = false;

  if (isMockMode) {
    events = mockCalendarEvents;
    tenants = [...new Set(mockConnections.map((connection) => connection.tenantName))];
  } else {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      shouldTriggerEntrySync = true;

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

      const eventSelectSummary = "id,subject,start_at,end_at,is_all_day,location,connection_id,organizer,calendar_source_id";
      const eventSelectFallback = "id,subject,start_at,end_at,location,connection_id,organizer,calendar_source_id";
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
      const summaryResult = connectionIds.length === 0 ? { data: [] as Array<Record<string, any>>, error: null } : await queryEvents(eventSelectSummary);
      const { data: dbEvents } = summaryResult.error ? await queryEvents(eventSelectFallback) : summaryResult;

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
        return {
          id: event.id,
          tenantName: tenantByConnection.get(event.connection_id) ?? "Connected Tenant",
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

      tenants = [...new Set((connections ?? []).map((connection) => connection.tenant_name ?? "Connected Tenant"))];
    }
  }

  return (
    <div className="space-y-4">
      <CalendarEntrySync enabled={shouldTriggerEntrySync} />
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
        <CalendarEventsOverview events={events} lazyEventDetail showCalendar={false} showRangeOverview={false} tenants={tenants} />
      </section>
    </div>
  );
}
