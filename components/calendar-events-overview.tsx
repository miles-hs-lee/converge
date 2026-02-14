"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { UnifiedWeekCalendar } from "@/components/unified-week-calendar";

export type CalendarEventRow = {
  id: string;
  tenantName: string;
  subject: string;
  startAt: string;
  endAt: string;
  location: string;
  sourceAccount: string;
  attendees: string[];
};

type CalendarEventsOverviewProps = {
  events: CalendarEventRow[];
  tenants: string[];
};

function formatRange(event: CalendarEventRow): string {
  return `${new Date(event.startAt).toLocaleString("ko-KR")} - ${new Date(event.endAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function EventList({ title, events }: { title: string; events: CalendarEventRow[] }) {
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
              {event.attendees.length > 0 ? <p className="mt-1 text-xs text-muted">참석자 {event.attendees.length}명</p> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function CalendarEventsOverview({ events, tenants }: CalendarEventsOverviewProps) {
  const [query, setQuery] = useState("");
  const [rangeDays, setRangeDays] = useState<3 | 7>(3);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return events;
    }

    return events.filter((event) => {
      return (
        event.subject.toLowerCase().includes(q) ||
        event.location.toLowerCase().includes(q) ||
        event.tenantName.toLowerCase().includes(q) ||
        event.sourceAccount.toLowerCase().includes(q) ||
        event.attendees.some((attendee) => attendee.toLowerCase().includes(q))
      );
    });
  }, [events, query]);

  const visibleTenants = useMemo(() => {
    if (!query.trim()) {
      return tenants;
    }
    return [...new Set(filteredEvents.map((event) => event.tenantName))];
  }, [filteredEvents, query, tenants]);

  const nowTs = Date.now();
  const rangeMs = rangeDays * 24 * 60 * 60 * 1000;

  const pastEvents = useMemo(() => {
    return [...filteredEvents]
      .filter((event) => {
        const end = new Date(event.endAt).getTime();
        return end < nowTs && end >= nowTs - rangeMs;
      })
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
      .slice(0, 8);
  }, [filteredEvents, nowTs, rangeMs]);

  const upcomingEvents = useMemo(() => {
    return [...filteredEvents]
      .filter((event) => {
        const start = new Date(event.startAt).getTime();
        return start >= nowTs && start <= nowTs + rangeMs;
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 8);
  }, [filteredEvents, nowTs, rangeMs]);

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
          <input
            className="input-control pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="일정 검색 (제목/장소/테넌트/참석자)"
            type="search"
            value={query}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {visibleTenants.map((tenant) => (
          <span className="badge" key={tenant}>
            {tenant}
          </span>
        ))}
      </div>

      <UnifiedWeekCalendar events={filteredEvents} tenants={visibleTenants} />

      <section className="panel-glass card mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="title-lg">오늘 기준 전후 일정</h2>
            <p className="muted mt-1">현재 필터: ±{rangeDays}일</p>
          </div>
          <div className="inline-flex rounded-xl border border-line bg-white p-0.5">
            <button
              className={`rounded-lg px-3 py-1.5 text-sm ${rangeDays === 3 ? "bg-slate-900 text-white" : "text-slate-700"}`}
              onClick={() => setRangeDays(3)}
              type="button"
            >
              ±3일
            </button>
            <button
              className={`rounded-lg px-3 py-1.5 text-sm ${rangeDays === 7 ? "bg-slate-900 text-white" : "text-slate-700"}`}
              onClick={() => setRangeDays(7)}
              type="button"
            >
              ±7일
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <EventList title="지난 일정" events={pastEvents} />
          <EventList title="예정 일정" events={upcomingEvents} />
        </div>
      </section>
    </>
  );
}
