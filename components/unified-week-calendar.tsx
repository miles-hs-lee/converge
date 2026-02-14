"use client";

import { useMemo, useState } from "react";

type CalendarEvent = {
  id: string;
  tenantName: string;
  subject: string;
  startAt: string;
  endAt: string;
  location: string;
};

type UnifiedWeekCalendarProps = {
  events: CalendarEvent[];
  tenants: string[];
};

const tenantPalette = ["#0f766e", "#0284c7", "#475569", "#059669", "#7c3aed", "#b45309"];

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - distanceFromMonday);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function sameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function weekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  return `${weekStart.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric"
  })}`;
}

export function UnifiedWeekCalendar({ events, tenants }: UnifiedWeekCalendarProps) {
  const [offsetWeek, setOffsetWeek] = useState(0);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date());
    return addDays(base, offsetWeek * 7);
  }, [offsetWeek]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx)), [weekStart]);

  const colorByTenant = useMemo(() => {
    const map = new Map<string, string>();
    tenants.forEach((tenant, index) => {
      map.set(tenant, tenantPalette[index % tenantPalette.length]);
    });
    return map;
  }, [tenants]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    days.forEach((day) => {
      const key = day.toDateString();
      const daily = events
        .filter((event) => sameDate(new Date(event.startAt), day))
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
      map.set(key, daily);
    });

    return map;
  }, [days, events]);

  return (
    <div className="mt-4 rounded-2xl border border-line bg-white/70 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{weekLabel(weekStart)}</p>
        <div className="flex items-center gap-2">
          <button className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm" onClick={() => setOffsetWeek((p) => p - 1)} type="button">
            이전 주
          </button>
          <button className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm" onClick={() => setOffsetWeek(0)} type="button">
            오늘
          </button>
          <button className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm" onClick={() => setOffsetWeek((p) => p + 1)} type="button">
            다음 주
          </button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-7">
        {days.map((day) => {
          const key = day.toDateString();
          const dailyEvents = eventsByDay.get(key) ?? [];
          const isToday = sameDate(day, new Date());

          return (
            <section className="min-h-40 rounded-xl border border-line bg-white/85 p-2" key={key}>
              <header className="mb-2 border-b border-line pb-2">
                <p className="text-xs uppercase tracking-[0.14em] text-muted">{day.toLocaleDateString("ko-KR", { weekday: "short" })}</p>
                <p className={`text-sm font-semibold ${isToday ? "text-accent" : "text-slate-700"}`}>
                  {day.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                </p>
              </header>

              <div className="space-y-2">
                {dailyEvents.map((event) => {
                  const color = colorByTenant.get(event.tenantName) ?? "#0f766e";
                  return (
                    <article className="rounded-lg border border-line bg-white p-2" key={event.id}>
                      <p className="line-clamp-1 text-xs font-semibold">{event.subject}</p>
                      <p className="mt-1 text-[11px] text-muted">
                        {new Date(event.startAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} -{" "}
                        {new Date(event.endAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <div className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${color}1f`, color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                        {event.tenantName}
                      </div>
                    </article>
                  );
                })}

                {dailyEvents.length === 0 ? <p className="pt-4 text-center text-xs text-muted">일정 없음</p> : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
