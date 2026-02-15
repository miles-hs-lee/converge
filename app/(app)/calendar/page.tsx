import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/mock-mode";
import { mockCalendarEvents, mockConnections } from "@/lib/mock-data";
import { CalendarEventsOverview, type CalendarEventRow } from "@/components/calendar-events-overview";
import { getServerLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

function parseAttendees(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }
      if (typeof item === "object" && item && "emailAddress" in item) {
        const emailAddress = (item as { emailAddress?: { address?: string } }).emailAddress;
        return emailAddress?.address ?? null;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
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
      const now = Date.now();
      const from = new Date(now - 1000 * 60 * 60 * 24 * 14).toISOString();
      const to = new Date(now + 1000 * 60 * 60 * 24 * 21).toISOString();

      const { data: connections } = await supabase
        .from("m365_connections")
        .select("id,tenant_name,m365_user_principal_name")
        .order("created_at", { ascending: true });

      const { data: dbEvents } = await supabase
        .from("calendar_events_cache")
        .select("id,subject,start_at,end_at,location,connection_id,organizer,attendees")
        .gte("start_at", from)
        .lte("start_at", to)
        .order("start_at", { ascending: true })
        .limit(120);

      const tenantByConnection = new Map<string, string>();
      const accountByConnection = new Map<string, string>();
      (connections ?? []).forEach((connection) => {
        tenantByConnection.set(connection.id, connection.tenant_name ?? "Connected Tenant");
        accountByConnection.set(connection.id, connection.m365_user_principal_name ?? "unknown@account");
      });

      events = (dbEvents ?? []).map((event) => ({
        id: event.id,
        tenantName: tenantByConnection.get(event.connection_id) ?? "Connected Tenant",
        subject: event.subject ?? "(제목 없음)",
        startAt: event.start_at,
        endAt: event.end_at,
        location: event.location ?? "미지정",
        sourceAccount: accountByConnection.get(event.connection_id) ?? event.organizer ?? "unknown@account",
        attendees: parseAttendees(event.attendees)
      }));

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
