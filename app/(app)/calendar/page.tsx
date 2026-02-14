import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/mock-mode";
import { mockCalendarEvents, mockConnections } from "@/lib/mock-data";
import { UnifiedWeekCalendar } from "@/components/unified-week-calendar";

type EventRow = {
  id: string;
  tenantName: string;
  subject: string;
  startAt: string;
  endAt: string;
  location: string;
  sourceAccount: string;
  attendees: string[];
};

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

function formatRange(event: EventRow): string {
  return `${new Date(event.startAt).toLocaleString("ko-KR")} - ${new Date(event.endAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function EventList({ title, events }: { title: string; events: EventRow[] }) {
  return (
    <section className="rounded-xl border border-line bg-white/80 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {events.length === 0 ? (
        <p className="muted mt-2">해당 일정이 없습니다.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {events.map((event) => (
            <article className="rounded-lg border border-line bg-white p-3" key={event.id}>
              <p className="text-sm font-medium">{event.subject}</p>
              <p className="mt-1 text-xs text-muted">{formatRange(event)}</p>
              <p className="mt-1 text-xs text-muted">
                {event.tenantName} · {event.sourceAccount} · {event.location}
              </p>
              {event.attendees.length > 0 ? (
                <p className="mt-1 text-xs text-muted">참석자 {event.attendees.length}명</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function CalendarPage() {
  let events: EventRow[] = [];
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

  const nowTs = Date.now();
  const pastEvents = [...events]
    .filter((event) => new Date(event.endAt).getTime() < nowTs)
    .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
    .slice(0, 6);

  const upcomingEvents = [...events]
    .filter((event) => new Date(event.startAt).getTime() >= nowTs)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <section className="panel-glass card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="title-xl">통합 캘린더</h1>
            <p className="muted mt-1">연결된 계정의 일정을 하나의 캘린더로 보여줍니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tenants.map((tenant) => (
              <span className="badge" key={tenant}>
                {tenant}
              </span>
            ))}
          </div>
        </div>

        <UnifiedWeekCalendar events={events} tenants={tenants} />
      </section>

      <section className="panel-glass card p-5">
        <h2 className="title-lg">오늘 기준 전후 일정</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <EventList title="지난 일정" events={pastEvents} />
          <EventList title="예정 일정" events={upcomingEvents} />
        </div>
      </section>
    </div>
  );
}
