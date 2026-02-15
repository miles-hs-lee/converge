"use client";

import { useMemo, useState } from "react";

type CalendarEvent = {
  id: string;
  tenantName: string;
  subject: string;
  startAt: string;
  endAt: string;
  location: string;
  sourceAccount: string;
  attendees: string[];
};

type UnifiedWeekCalendarProps = {
  events: CalendarEvent[];
  tenants: string[];
};

type ViewMode = "week" | "month";

const tenantPalette = ["#0f766e", "#0284c7", "#475569", "#059669", "#7c3aed", "#b45309"];

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function sameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - distanceFromMonday);
  return result;
}

function startOfMonthGrid(date: Date): Date {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfWeek(first);
}

function weekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  return `${weekStart.toLocaleDateString("ko-KR", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric"
  })}`;
}

function monthLabel(monthDate: Date): string {
  return monthDate.toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function UnifiedWeekCalendar({ events, tenants }: UnifiedWeekCalendarProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [offsetWeek, setOffsetWeek] = useState(0);
  const [offsetMonth, setOffsetMonth] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date());
    return addDays(base, offsetWeek * 7);
  }, [offsetWeek]);

  const monthDate = useMemo(() => {
    const base = new Date();
    return new Date(base.getFullYear(), base.getMonth() + offsetMonth, 1);
  }, [offsetMonth]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx)), [weekStart]);
  const monthDays = useMemo(() => {
    const start = startOfMonthGrid(monthDate);
    return Array.from({ length: 42 }, (_, idx) => addDays(start, idx));
  }, [monthDate]);

  const colorByTenant = useMemo(() => {
    const map = new Map<string, string>();
    tenants.forEach((tenant, index) => {
      map.set(tenant, tenantPalette[index % tenantPalette.length]);
    });
    return map;
  }, [tenants]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const start = new Date(event.startAt);
      const key = dayKey(start);
      const existing = map.get(key) ?? [];
      existing.push(event);
      existing.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
      map.set(key, existing);
    });
    return map;
  }, [events]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) {
      return null;
    }
    return events.find((event) => event.id === selectedEventId) ?? null;
  }, [events, selectedEventId]);

  const label = viewMode === "week" ? weekLabel(weekStart) : monthLabel(monthDate);

  function goPrev() {
    if (viewMode === "week") {
      setOffsetWeek((prev) => prev - 1);
      return;
    }
    setOffsetMonth((prev) => prev - 1);
  }

  function goToday() {
    setOffsetWeek(0);
    setOffsetMonth(0);
  }

  function goNext() {
    if (viewMode === "week") {
      setOffsetWeek((prev) => prev + 1);
      return;
    }
    setOffsetMonth((prev) => prev + 1);
  }

  function openEvent(eventId: string) {
    setSelectedEventId(eventId);
  }

  function closeEventModal() {
    setSelectedEventId(null);
  }

  return (
    <>
      <div className="mt-5 rounded-2xl border border-line bg-white/78 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold tracking-tight">{label}</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-line bg-white p-0.5 text-sm">
              <button
                className={`rounded-lg px-3 py-1.5 font-medium ${viewMode === "week" ? "bg-accent text-white" : "text-slate-700"}`}
                onClick={() => setViewMode("week")}
                type="button"
              >
                주간
              </button>
              <button
                className={`rounded-lg px-3 py-1.5 font-medium ${viewMode === "month" ? "bg-accent text-white" : "text-slate-700"}`}
                onClick={() => setViewMode("month")}
                type="button"
              >
                월간
              </button>
            </div>
            <button className="btn btn-secondary px-3 py-1.5" onClick={goPrev} type="button">
              이전
            </button>
            <button className="btn btn-secondary px-3 py-1.5" onClick={goToday} type="button">
              오늘
            </button>
            <button className="btn btn-secondary px-3 py-1.5" onClick={goNext} type="button">
              다음
            </button>
          </div>
        </div>

        {viewMode === "week" ? (
          <div className="grid gap-2 md:grid-cols-7">
            {weekDays.map((day) => {
              const key = dayKey(day);
              const dailyEvents = eventsByDay.get(key) ?? [];
              const isToday = sameDate(day, new Date());
              return (
                <section className="min-h-44 rounded-xl border border-line bg-white/90 p-2" key={key}>
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
                        <button
                          className="w-full rounded-lg border border-line bg-white p-2 text-left transition hover:border-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                          key={event.id}
                          onClick={() => openEvent(event.id)}
                          type="button"
                        >
                          <p className="line-clamp-1 text-xs font-semibold">{event.subject}</p>
                          <p className="mt-1 text-[11px] text-muted">
                            {new Date(event.startAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <div
                            className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{ backgroundColor: `${color}1f`, color }}
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                            {event.tenantName}
                          </div>
                        </button>
                      );
                    })}
                    {dailyEvents.length === 0 ? <p className="pt-4 text-center text-xs text-muted">일정 없음</p> : null}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div>
            <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.12em] text-muted">
              {["월", "화", "수", "목", "금", "토", "일"].map((day) => (
                <p key={day}>{day}</p>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {monthDays.map((day) => {
                const key = dayKey(day);
                const dailyEvents = eventsByDay.get(key) ?? [];
                const inCurrentMonth = day.getMonth() === monthDate.getMonth();
                const isToday = sameDate(day, new Date());
                return (
                  <section className="min-h-28 rounded-xl border border-line bg-white/90 p-2" key={key}>
                    <p className={`text-xs font-semibold ${isToday ? "text-accent" : inCurrentMonth ? "text-slate-700" : "text-slate-400"}`}>
                      {day.getDate()}
                    </p>
                    <div className="mt-2 space-y-1">
                      {dailyEvents.slice(0, 3).map((event) => {
                        const color = colorByTenant.get(event.tenantName) ?? "#0f766e";
                        return (
                          <button
                            className="block w-full truncate rounded-md px-1.5 py-1 text-left text-[11px] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                            key={event.id}
                            onClick={() => openEvent(event.id)}
                            style={{ backgroundColor: `${color}1f`, color }}
                            type="button"
                          >
                            {new Date(event.startAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} {event.subject}
                          </button>
                        );
                      })}
                      {dailyEvents.length > 3 ? <p className="text-[10px] text-muted">+{dailyEvents.length - 3} more</p> : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedEvent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true">
          <button aria-label="닫기" className="absolute inset-0 cursor-default" onClick={closeEventModal} type="button" />
          <section className="panel-glass card relative z-10 w-full max-w-lg p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-accent">Event Detail</p>
                <h3 className="mt-1 text-lg font-semibold">{selectedEvent.subject}</h3>
                <p className="mt-1 text-xs text-muted">
                  {new Date(selectedEvent.startAt).toLocaleString("ko-KR")} - {new Date(selectedEvent.endAt).toLocaleTimeString("ko-KR")}
                </p>
              </div>
              <button className="btn btn-secondary px-3 py-1.5" onClick={closeEventModal} type="button">
                닫기
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.12em] text-muted">원본 테넌트</p>
                <p className="mt-1 font-medium">{selectedEvent.tenantName}</p>
              </div>

              <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.12em] text-muted">원본 계정</p>
                <p className="mt-1 font-medium">{selectedEvent.sourceAccount}</p>
              </div>

              <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.12em] text-muted">장소</p>
                <p className="mt-1 font-medium">{selectedEvent.location}</p>
              </div>

              <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                <p className="text-xs uppercase tracking-[0.12em] text-muted">참석자</p>
                {selectedEvent.attendees.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {selectedEvent.attendees.map((attendee) => (
                      <li key={attendee}>{attendee}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-muted">표시 가능한 참석자 정보가 없습니다.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
