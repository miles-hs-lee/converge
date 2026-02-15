"use client";

import { useMemo, useState } from "react";
import { ModalPortal } from "@/components/modal-portal";
import { colorForTenant } from "@/lib/tenant-colors";
import { useIntlLocale, useT } from "@/components/locale-provider";

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

function weekLabel(weekStart: Date, intl: string): string {
  const end = addDays(weekStart, 6);
  return `${weekStart.toLocaleDateString(intl, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(intl, {
    month: "short",
    day: "numeric"
  })}`;
}

function monthLabel(monthDate: Date, intl: string): string {
  return monthDate.toLocaleDateString(intl, { year: "numeric", month: "long" });
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function UnifiedWeekCalendar({ events, tenants }: UnifiedWeekCalendarProps) {
  const t = useT();
  const intl = useIntlLocale();

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [offsetWeek, setOffsetWeek] = useState(0);
  const [offsetMonth, setOffsetMonth] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [moreDayKeyValue, setMoreDayKeyValue] = useState<string | null>(null);

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

  // Keep signature but avoid tenant order affecting colors.
  useMemo(() => tenants, [tenants]);

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

  const moreEvents = useMemo(() => {
    if (!moreDayKeyValue) {
      return [];
    }
    return eventsByDay.get(moreDayKeyValue) ?? [];
  }, [eventsByDay, moreDayKeyValue]);

  const label = viewMode === "week" ? weekLabel(weekStart, intl) : monthLabel(monthDate, intl);

  function dateNumberClass(day: Date, isToday: boolean, inCurrentMonth = true): string {
    if (!inCurrentMonth) {
      return "text-slate-400";
    }

    const dayOfWeek = day.getDay();
    if (dayOfWeek === 6) {
      return "text-sky-600";
    }
    if (dayOfWeek === 0) {
      return "text-rose-600";
    }
    return isToday ? "text-accent" : "text-slate-700";
  }

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

  function openMore(day: Date) {
    setMoreDayKeyValue(dayKey(day));
  }

  function closeMore() {
    setMoreDayKeyValue(null);
  }

  const inlineLimitWeek = 4;
  const inlineLimitMonth = 3;

  const weekdayLabels = useMemo(() => {
    return [t("weekday.mon"), t("weekday.tue"), t("weekday.wed"), t("weekday.thu"), t("weekday.fri"), t("weekday.sat"), t("weekday.sun")];
  }, [t]);

  return (
    <>
      <div className="mt-5 rounded-2xl border border-line bg-white/78 p-2 sm:p-3">
        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold tracking-tight">{label}</p>
            <div className="inline-flex rounded-xl border border-line bg-white p-0.5 text-sm">
              <button
                className={`rounded-lg px-3 py-1.5 font-medium ${viewMode === "week" ? "bg-accent text-white" : "text-slate-700"}`}
                onClick={() => setViewMode("week")}
                type="button"
              >
                {t("common.week")}
              </button>
              <button
                className={`rounded-lg px-3 py-1.5 font-medium ${viewMode === "month" ? "bg-accent text-white" : "text-slate-700"}`}
                onClick={() => setViewMode("month")}
                type="button"
              >
                {t("common.month")}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <button className="btn btn-secondary px-3 py-1.5" onClick={goPrev} type="button">
              {t("common.prev")}
            </button>
            <button className="btn btn-secondary px-3 py-1.5" onClick={goToday} type="button">
              {t("common.today")}
            </button>
            <button className="btn btn-secondary px-3 py-1.5" onClick={goNext} type="button">
              {t("common.next")}
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
                    <p className="text-xs uppercase tracking-[0.14em] text-muted">{day.toLocaleDateString(intl, { weekday: "short" })}</p>
                    <p className={`text-sm font-semibold ${dateNumberClass(day, isToday)}`}>
                      {day.toLocaleDateString(intl, { month: "numeric", day: "numeric" })}
                    </p>
                  </header>

                  <div className="space-y-2">
                    {dailyEvents.slice(0, inlineLimitWeek).map((event) => {
                      const color = colorForTenant(event.tenantName);
                      return (
                        <button
                          className="w-full rounded-lg border border-line bg-white p-2 text-left transition hover:border-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                          key={event.id}
                          onClick={() => openEvent(event.id)}
                          type="button"
                        >
                          <p className="line-clamp-1 text-xs font-semibold">{event.subject}</p>
                          <p className="mt-1 text-[11px] text-muted">
                            {new Date(event.startAt).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })}
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
                    {dailyEvents.length > inlineLimitWeek ? (
                      <button
                        className="w-full rounded-lg border border-line bg-white/90 px-2 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:border-accent/45 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                        onClick={() => openMore(day)}
                        type="button"
                      >
                        {t("common.more", { count: dailyEvents.length - inlineLimitWeek })}
                      </button>
                    ) : null}
                    {dailyEvents.length === 0 ? <p className="pt-4 text-center text-xs text-muted">{t("calendar.none")}</p> : null}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="-mx-1 overflow-x-auto pb-1">
            <div className="min-w-[720px] px-1">
              <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.12em] text-muted">
                {weekdayLabels.map((dayLabel, index) => {
                  const weekendClass = index === 5 ? "text-sky-600" : index === 6 ? "text-rose-600" : "";
                  return (
                    <p className={weekendClass} key={dayLabel}>
                      {dayLabel}
                    </p>
                  );
                })}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {monthDays.map((day) => {
                  const key = dayKey(day);
                  const dailyEvents = eventsByDay.get(key) ?? [];
                  const inCurrentMonth = day.getMonth() === monthDate.getMonth();
                  const isToday = sameDate(day, new Date());
                  return (
                    <section className="min-h-28 rounded-xl border border-line bg-white/90 p-2" key={key}>
                      <p className={`text-xs font-semibold ${dateNumberClass(day, isToday, inCurrentMonth)}`}>
                        {day.getDate()}
                      </p>
                      <div className="mt-2 space-y-1">
                        {dailyEvents.slice(0, inlineLimitMonth).map((event) => {
                          const color = colorForTenant(event.tenantName);
                          return (
                            <button
                              className="block w-full truncate rounded-md px-1.5 py-1 text-left text-[11px] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                              key={event.id}
                              onClick={() => openEvent(event.id)}
                              style={{ backgroundColor: `${color}1f`, color }}
                              type="button"
                            >
                              {new Date(event.startAt).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })} {event.subject}
                            </button>
                          );
                        })}
                        {dailyEvents.length > inlineLimitMonth ? (
                          <button
                            className="mt-1 inline-flex text-[10px] font-medium text-slate-600 transition hover:text-accent"
                            onClick={() => openMore(day)}
                            type="button"
                          >
                            {t("common.more", { count: dailyEvents.length - inlineLimitMonth })}
                          </button>
                        ) : null}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {moreDayKeyValue ? (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4" role="dialog" aria-modal="true">
            <button aria-label={t("common.close")} className="absolute inset-0 cursor-default" onClick={closeMore} type="button" />
            <section className="panel-glass card relative z-10 max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-2xl p-4 pb-7 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-accent">{t("calendar.title")}</p>
                  <h3 className="mt-1 text-lg font-semibold">
                    {(() => {
                      const [y, m, d] = moreDayKeyValue.split("-").map((v) => Number(v));
                      const date = new Date(y ?? 0, m ?? 0, d ?? 0);
                      return date.toLocaleDateString(intl, { year: "numeric", month: "long", day: "numeric", weekday: "short" });
                    })()}
                  </h3>
                  <p className="mt-1 text-xs text-muted">{t("common.total", { count: moreEvents.length })}</p>
                </div>
                <button className="btn btn-secondary px-3 py-1.5" onClick={closeMore} type="button">
                  {t("common.close")}
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {moreEvents.map((event) => {
                  const color = colorForTenant(event.tenantName);
                  return (
                    <button
                      className="w-full rounded-xl border border-line bg-white/90 p-3 text-left transition hover:border-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                      key={event.id}
                      onClick={() => {
                        closeMore();
                        openEvent(event.id);
                      }}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{event.subject}</p>
                          <p className="mt-1 text-xs text-muted">
                            {new Date(event.startAt).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })} -{" "}
                            {new Date(event.endAt).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <p className="mt-1 text-xs text-muted">{event.location}</p>
                        </div>
                        <div
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: `${color}1f`, color }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                          {event.tenantName}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </ModalPortal>
      ) : null}

      {selectedEvent ? (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4" role="dialog" aria-modal="true">
            <button aria-label={t("common.close")} className="absolute inset-0 cursor-default" onClick={closeEventModal} type="button" />
            <section className="panel-glass card relative z-10 max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-2xl p-4 pb-7 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-accent">{t("event.detailTitle")}</p>
                  <h3 className="mt-1 text-lg font-semibold">{selectedEvent.subject}</h3>
                  <p className="mt-1 text-xs text-muted">
                    {new Date(selectedEvent.startAt).toLocaleString(intl)} - {new Date(selectedEvent.endAt).toLocaleTimeString(intl)}
                  </p>
                </div>
                <button className="btn btn-secondary px-3 py-1.5" onClick={closeEventModal} type="button">
                  {t("common.close")}
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("event.sourceTenant")}</p>
                  <p className="mt-1 font-medium">{selectedEvent.tenantName}</p>
                </div>

                <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("event.sourceAccount")}</p>
                  <p className="mt-1 font-medium">{selectedEvent.sourceAccount}</p>
                </div>

                <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("event.location")}</p>
                  <p className="mt-1 font-medium">{selectedEvent.location}</p>
                </div>

                <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("event.attendees")}</p>
                  {selectedEvent.attendees.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {selectedEvent.attendees.map((attendee) => (
                        <li key={attendee}>{attendee}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-muted">{t("event.attendeesEmpty")}</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
