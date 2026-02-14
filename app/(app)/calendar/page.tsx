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
};

const tenantColors = ["bg-teal-500", "bg-sky-500", "bg-slate-500", "bg-emerald-500"];

function detectConflicts(events: EventRow[]): number {
  let conflicts = 0;
  const sorted = [...events].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  for (let i = 1; i < sorted.length; i += 1) {
    const prevEnd = new Date(sorted[i - 1].endAt).getTime();
    const currentStart = new Date(sorted[i].startAt).getTime();
    if (currentStart < prevEnd) {
      conflicts += 1;
    }
  }

  return conflicts;
}

export default async function CalendarPage() {
  let events: EventRow[] = [];
  let tenants: string[] = [];

  if (isMockMode) {
    events = mockCalendarEvents.map((event) => ({
      id: event.id,
      tenantName: event.tenantName,
      subject: event.subject,
      startAt: event.startAt,
      endAt: event.endAt,
      location: event.location
    }));
    tenants = [...new Set(mockConnections.map((connection) => connection.tenantName))];
  } else {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      const { data: connections } = await supabase
        .from("m365_connections")
        .select("id,tenant_name")
        .order("created_at", { ascending: true });

      const { data: dbEvents } = await supabase
        .from("calendar_events_cache")
        .select("id,subject,start_at,end_at,location,connection_id")
        .gte("end_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(20);

      const nameByConnection = new Map<string, string>();
      (connections ?? []).forEach((connection) => {
        nameByConnection.set(connection.id, connection.tenant_name ?? "Connected Tenant");
      });

      events = (dbEvents ?? []).map((event) => ({
        id: event.id,
        tenantName: nameByConnection.get(event.connection_id) ?? "Connected Tenant",
        subject: event.subject ?? "(제목 없음)",
        startAt: event.start_at,
        endAt: event.end_at,
        location: event.location ?? "미지정"
      }));

      tenants = [...new Set((connections ?? []).map((connection) => connection.tenant_name ?? "Connected Tenant"))];
    }
  }

  const todaysEvents = events.filter((event) => {
    const start = new Date(event.startAt);
    const now = new Date();
    return start.toDateString() === now.toDateString();
  }).length;

  const conflictCount = detectConflicts(events);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="panel-glass card p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-accent">Calendar Workspace</p>
        <h1 className="mt-2 text-xl font-semibold">통합 캘린더</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          연결된 계정의 이벤트를 하나의 타임라인으로 통합해 보여줍니다. 계정별 색상으로 출처를 구분하고 충돌 슬롯을
          빠르게 파악할 수 있습니다.
        </p>

        {isMockMode ? (
          <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
            Mock 모드로 실행 중입니다. 관리자 승인 전 UI와 검색 흐름을 검증할 수 있습니다.
          </p>
        ) : null}

        <div className="mt-5 space-y-2">
          {tenants.map((tenantName, index) => (
            <div className="flex items-center gap-2 text-sm" key={tenantName}>
              <span className={`h-2.5 w-2.5 rounded-full ${tenantColors[index % tenantColors.length]}`} />
              <span>{tenantName}</span>
            </div>
          ))}
          {tenants.length === 0 ? <p className="text-sm text-muted">연결된 테넌트가 없습니다.</p> : null}
        </div>
      </aside>

      <section className="panel-glass card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Upcoming Events</p>
            <h2 className="text-lg font-semibold">Week Focus</h2>
          </div>
        </div>
        <UnifiedWeekCalendar events={events} tenants={tenants} />

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-line bg-white/80 p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Events Today</p>
            <p className="mt-2 text-2xl font-semibold">{todaysEvents}</p>
          </div>
          <div className="rounded-xl border border-line bg-white/80 p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Conflict Slots</p>
            <p className="mt-2 text-2xl font-semibold text-rose-600">{conflictCount}</p>
          </div>
          <div className="rounded-xl border border-line bg-white/80 p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Connected Tenants</p>
            <p className="mt-2 text-2xl font-semibold">{tenants.length}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
