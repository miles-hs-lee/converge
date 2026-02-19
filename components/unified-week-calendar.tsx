"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  organizer?: string;
  isAllDay?: boolean;
  webLink?: string | null;
  lastModifiedAt?: string | null;
  calendarName?: string;
  provider?: string;
};

type UnifiedWeekCalendarProps = {
  events: CalendarEvent[];
  tenants: string[];
};

type ViewMode = "day" | "week" | "month";

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function sameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
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

function dayLabel(dayDate: Date, intl: string): string {
  return dayDate.toLocaleDateString(intl, { year: "numeric", month: "short", day: "numeric", weekday: "short" });
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function minutesIntoDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function formatDuration(startIso: string, endIso: string): string {
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return "-";
  }
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return remain === 0 ? `${hours}h` : `${hours}h ${remain}m`;
}

export function UnifiedWeekCalendar({ events, tenants }: UnifiedWeekCalendarProps) {
  const t = useT();
  const intl = useIntlLocale();

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [offsetDay, setOffsetDay] = useState(0);
  const [offsetWeek, setOffsetWeek] = useState(0);
  const [offsetMonth, setOffsetMonth] = useState(0);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [moreDayKeyValue, setMoreDayKeyValue] = useState<string | null>(null);
  const [canHover, setCanHover] = useState(false);
  const [hovered, setHovered] = useState<{ event: CalendarEvent; rect: DOMRect } | null>(null);

  const dayScrollRef = useRef<HTMLDivElement | null>(null);
  const lastAutoScrollKey = useRef<string | null>(null);

  const dayDate = useMemo(() => {
    const base = startOfDay(new Date());
    return addDays(base, offsetDay);
  }, [offsetDay]);

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

  const label = viewMode === "day" ? dayLabel(dayDate, intl) : viewMode === "week" ? weekLabel(weekStart, intl) : monthLabel(monthDate, intl);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    if (!media) {
      setCanHover(false);
      return;
    }
    const update = () => setCanHover(Boolean(media.matches));
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

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
    if (viewMode === "day") {
      setOffsetDay((prev) => prev - 1);
      return;
    }
    if (viewMode === "week") {
      setOffsetWeek((prev) => prev - 1);
      return;
    }
    setOffsetMonth((prev) => prev - 1);
  }

  function goToday() {
    setOffsetDay(0);
    setOffsetWeek(0);
    setOffsetMonth(0);
  }

  function goNext() {
    if (viewMode === "day") {
      setOffsetDay((prev) => prev + 1);
      return;
    }
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

  function openHover(event: CalendarEvent, el: HTMLElement) {
    if (!canHover) return;
    setHovered({ event, rect: el.getBoundingClientRect() });
  }

  function closeHover() {
    setHovered(null);
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

  const dayEvents = useMemo(() => {
    const dayStart = startOfDay(dayDate);
    const dayEnd = addDays(dayStart, 1);
    const startTs = dayStart.getTime();
    const endTs = dayEnd.getTime();

    return events
      .map((event) => {
        const s = new Date(event.startAt).getTime();
        const e = new Date(event.endAt).getTime();
        return { event, s, e };
      })
      .filter((row) => Number.isFinite(row.s) && Number.isFinite(row.e) && row.e > row.s && row.s < endTs && row.e > startTs)
      .sort((a, b) => a.s - b.s)
      .map((row) => row.event);
  }, [dayDate, events]);

  const dayLayout = useMemo(() => {
    if (dayEvents.length === 0) {
      return [];
    }

    const dayStart = startOfDay(dayDate).getTime();
    const dayEnd = addDays(new Date(dayStart), 1).getTime();
    const MIN = 0;
    const MAX = 24 * 60;

    type Item = {
      event: CalendarEvent;
      startMin: number;
      endMin: number;
      clusterId: number;
      col: number;
      colCount: number;
    };

    const base: Item[] = dayEvents
      .map((event) => {
        const s = new Date(event.startAt).getTime();
        const e = new Date(event.endAt).getTime();
        const clampedStart = clamp(Math.floor((Math.max(s, dayStart) - dayStart) / 60000), MIN, MAX);
        const clampedEnd = clamp(Math.ceil((Math.min(e, dayEnd) - dayStart) / 60000), MIN, MAX);
        return {
          event,
          startMin: clampedStart,
          endMin: Math.max(clampedEnd, clampedStart + 5),
          clusterId: -1,
          col: 0,
          colCount: 1
        };
      })
      .filter((it) => it.endMin > it.startMin)
      .sort((a, b) => (a.startMin !== b.startMin ? a.startMin - b.startMin : b.endMin - a.endMin));

    // First pass: assign clusters of overlapping events.
    let cluster = -1;
    let activeEnds: number[] = [];
    for (const it of base) {
      activeEnds = activeEnds.filter((end) => end > it.startMin);
      if (activeEnds.length === 0) {
        cluster += 1;
      }
      it.clusterId = cluster;
      activeEnds.push(it.endMin);
    }

    // Second pass: for each cluster, assign columns.
    const byCluster = new Map<number, Item[]>();
    base.forEach((it) => {
      const arr = byCluster.get(it.clusterId) ?? [];
      arr.push(it);
      byCluster.set(it.clusterId, arr);
    });

    for (const [, items] of byCluster.entries()) {
      items.sort((a, b) => (a.startMin !== b.startMin ? a.startMin - b.startMin : b.endMin - a.endMin));
      const active: Array<{ endMin: number; col: number }> = [];
      let maxCols = 0;

      for (const it of items) {
        for (let i = active.length - 1; i >= 0; i -= 1) {
          if (active[i]!.endMin <= it.startMin) {
            active.splice(i, 1);
          }
        }

        const used = new Set(active.map((a) => a.col));
        let col = 0;
        while (used.has(col)) col += 1;

        it.col = col;
        active.push({ endMin: it.endMin, col });
        maxCols = Math.max(maxCols, active.length, col + 1);
      }

      items.forEach((it) => {
        it.colCount = Math.max(1, maxCols);
      });
    }

    return base;
  }, [dayDate, dayEvents]);

  const dayFirstStartMin = useMemo(() => {
    if (dayLayout.length === 0) return null;
    let min = Number.POSITIVE_INFINITY;
    dayLayout.forEach((it) => {
      min = Math.min(min, it.startMin);
    });
    return Number.isFinite(min) ? min : null;
  }, [dayLayout]);

  useEffect(() => {
    if (viewMode !== "day") return;
    if (!dayScrollRef.current) return;

    const key = `${dayKey(dayDate)}|${dayFirstStartMin ?? "none"}`;
    if (lastAutoScrollKey.current === key) return;
    lastAutoScrollKey.current = key;

    const scroller = dayScrollRef.current;
    // Scroll near the first event (keep ~90 minutes context above).
    const targetMin = Math.max(0, (dayFirstStartMin ?? 0) - 90);
    const targetTop = (targetMin / 60) * 56;

    // Wait a tick so layout has a stable height.
    requestAnimationFrame(() => {
      try {
        scroller.scrollTo({ top: Math.max(0, targetTop - 24), behavior: "smooth" });
      } catch {
        scroller.scrollTop = Math.max(0, targetTop - 24);
      }
    });
  }, [dayDate, dayFirstStartMin, viewMode]);

  return (
    <>
      <div className="mt-5 rounded-2xl border border-line bg-white/78 p-2 sm:p-3">
        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold tracking-tight">{label}</p>
            <div className="inline-flex rounded-xl border border-line bg-white p-0.5 text-sm">
              <button
                className={`rounded-lg px-3 py-1.5 font-medium ${viewMode === "day" ? "bg-accent text-white" : "text-slate-700"}`}
                onClick={() => setViewMode("day")}
                type="button"
              >
                {t("common.day")}
              </button>
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

        {viewMode === "day" ? (
          <div className="overflow-hidden rounded-xl border border-line bg-white/90">
            <div className="max-h-[72vh] overflow-y-auto" ref={dayScrollRef}>
              <div className="grid grid-cols-[56px_1fr]">
                <div className="border-r border-line bg-white/95">
                  {Array.from({ length: 25 }, (_, hour) => (
                    <div className="relative h-14 border-b border-line px-2 py-1.5" key={hour}>
                      <p className="text-[11px] font-medium text-muted">
                        {hour === 24
                          ? ""
                          : new Date(0, 0, 0, hour, 0, 0).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="relative bg-white/90">
                  <div className="relative" style={{ height: 24 * 56 }}>
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div className="h-14 border-b border-line" key={hour} />
                    ))}

                    {sameDate(dayDate, new Date()) ? (
                      (() => {
                        const now = new Date();
                        const top = (minutesIntoDay(now) / 60) * 56;
                        return (
                          <div className="pointer-events-none absolute left-0 right-0" style={{ top }}>
                            <div className="h-px bg-rose-500/80" />
                            <div className="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-rose-500" />
                          </div>
                        );
                      })()
                    ) : null}

                    {dayLayout.map((item) => {
                      const { event, startMin, endMin, col, colCount } = item;
                      const color = colorForTenant(event.tenantName);
                      const top = (startMin / 60) * 56;
                      const height = Math.max(28, ((endMin - startMin) / 60) * 56);
                      const gap = colCount >= 4 ? 4 : colCount === 3 ? 6 : 8;
                      const leftPct = (col / colCount) * 100;
                      const widthPct = (1 / colCount) * 100;
                      const dense = colCount >= 3;

                      const size: "micro" | "compact" | "normal" | "rich" =
                        height < 34 ? "micro" : height < 52 ? "compact" : height < 78 ? "normal" : "rich";
                      const showTime = size !== "micro";
                      const showLocation = size === "rich" && !dense;
                      const showTenantLabel = !dense && colCount <= 2 && size !== "micro" && size !== "compact";
                      const subjectClamp = size === "normal" || size === "rich" ? "line-clamp-2" : "line-clamp-1";
                      const padClass = dense || size === "micro" ? "p-1.5" : "p-2";
                      const subjectClass = size === "micro" ? "text-[11px]" : dense ? "text-[11px]" : "text-xs";
                      const metaClass = dense || size === "micro" ? "text-[10px]" : "text-[11px]";

                      return (
                        <button
                          className={`absolute rounded-xl border border-line bg-white text-left shadow-soft transition hover:border-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
                            padClass
                          }`}
                          key={event.id}
                          onBlur={closeHover}
                          onClick={() => openEvent(event.id)}
                          onFocus={(e) => openHover(event, e.currentTarget)}
                          onMouseEnter={(e) => openHover(event, e.currentTarget)}
                          onMouseLeave={closeHover}
                          style={{
                            top,
                            height,
                            left: `calc(${leftPct}% + ${gap / 2}px)`,
                            width: `calc(${widthPct}% - ${gap}px)`,
                            borderLeft: `4px solid ${color}`
                          }}
                          type="button"
                        >
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <p className={`min-w-0 ${subjectClamp} font-semibold leading-tight ${subjectClass}`}>{event.subject}</p>
                            <span
                              className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-white/85 py-0.5 text-[10px] font-medium ${
                                dense || size === "micro" ? "px-1.5" : "px-2"
                              }`}
                              style={{ color }}
                            >
                              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                              {showTenantLabel ? <span className="max-w-[110px] truncate">{event.tenantName}</span> : null}
                            </span>
                          </div>
                          {showTime ? (
                            <p className={`mt-1 leading-tight text-muted ${metaClass}`}>
                              {new Date(event.startAt).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })} -{" "}
                              {new Date(event.endAt).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          ) : null}
                          {showLocation ? <p className="mt-1 line-clamp-1 text-[11px] leading-tight text-muted">{event.location}</p> : null}
                        </button>
                      );
                    })}

                    {dayLayout.length === 0 ? (
                      <div className="absolute inset-0 grid place-items-center p-6">
                        <p className="text-sm font-medium text-muted">{t("calendar.none")}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : viewMode === "week" ? (
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
                          onFocus={(e) => openHover(event, e.currentTarget)}
                          onBlur={closeHover}
                          onMouseEnter={(e) => openHover(event, e.currentTarget)}
                          onMouseLeave={closeHover}
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
                              onFocus={(e) => openHover(event, e.currentTarget)}
                              onBlur={closeHover}
                              onMouseEnter={(e) => openHover(event, e.currentTarget)}
                              onMouseLeave={closeHover}
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

      {hovered ? (
        <ModalPortal>
          {(() => {
            const centerX = hovered.rect.left + hovered.rect.width / 2;
            const approxWidth = 340;
            const vw = typeof window === "undefined" ? 1024 : window.innerWidth;
            const vh = typeof window === "undefined" ? 768 : window.innerHeight;
            const clampedLeft = Math.max(12 + approxWidth / 2, Math.min(vw - 12 - approxWidth / 2, centerX));
            const preferAbove = hovered.rect.bottom + 12 + 180 > vh;
            const top = preferAbove ? Math.max(12, hovered.rect.top - 12) : hovered.rect.bottom + 10;
            const transform = preferAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)";

            const start = new Date(hovered.event.startAt);
            const end = new Date(hovered.event.endAt);
            const sameDay = start.toDateString() === end.toDateString();
            const timeLine = sameDay
              ? `${start.toLocaleDateString(intl, { month: "short", day: "numeric", weekday: "short" })} · ${start.toLocaleTimeString(intl, {
                  hour: "2-digit",
                  minute: "2-digit"
                })} - ${end.toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })}`
              : `${start.toLocaleString(intl, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit"
                })} - ${end.toLocaleString(intl, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;

            return (
              <div className="pointer-events-none fixed inset-0 z-[60]">
                <div
                  className="panel-glass card w-[min(340px,calc(100vw-24px))] rounded-2xl border border-line/70 bg-white/95 p-3 shadow-soft"
                  style={{ left: clampedLeft, top, transform, position: "fixed" }}
                >
                  <p className="line-clamp-2 text-sm font-semibold text-text">{hovered.event.subject}</p>
                  <p className="mt-1 text-xs text-muted">{timeLine}</p>

                  <div className="mt-3 space-y-2 text-sm">
                    <div className="rounded-xl border border-line bg-white/80 p-2.5">
                      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{t("event.sourceTenant")}</p>
                      <p className="mt-1 text-xs font-semibold">{hovered.event.tenantName}</p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-line bg-white/80 p-2.5">
                        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{t("event.location")}</p>
                        <p className="mt-1 line-clamp-1 text-xs font-semibold">{hovered.event.location}</p>
                      </div>
                      <div className="rounded-xl border border-line bg-white/80 p-2.5">
                        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{t("event.sourceAccount")}</p>
                        <p className="mt-1 line-clamp-1 text-xs font-semibold">{hovered.event.sourceAccount}</p>
                      </div>
                    </div>

                    {hovered.event.organizer ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-line bg-white/80 p-2.5">
                          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{t("event.organizer")}</p>
                          <p className="mt-1 line-clamp-1 text-xs font-semibold">{hovered.event.organizer}</p>
                        </div>
                        <div className="rounded-xl border border-line bg-white/80 p-2.5">
                          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{t("event.calendar")}</p>
                          <p className="mt-1 line-clamp-1 text-xs font-semibold">{hovered.event.calendarName ?? "Calendar"}</p>
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-xl border border-line bg-white/80 p-2.5">
                      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted">{t("event.attendees")}</p>
                      <p className="mt-1 text-xs text-muted">
                        {hovered.event.attendees.length > 0 ? t("calendar.attendeesCount", { count: hovered.event.attendees.length }) : t("event.attendeesEmpty")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </ModalPortal>
      ) : null}

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
                      onFocus={(e) => openHover(event, e.currentTarget)}
                      onBlur={closeHover}
                      onMouseEnter={(e) => openHover(event, e.currentTarget)}
                      onMouseLeave={closeHover}
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
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("event.sourceTenant")}</p>
                    <p className="mt-1 font-medium">{selectedEvent.tenantName}</p>
                  </div>

                  <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("event.sourceAccount")}</p>
                    <p className="mt-1 font-medium">{selectedEvent.sourceAccount}</p>
                  </div>

                  <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("event.time")}</p>
                    <p className="mt-1 font-medium">
                      {new Date(selectedEvent.startAt).toLocaleString(intl, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        weekday: "short",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                      {" - "}
                      {new Date(selectedEvent.endAt).toLocaleString(intl, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>

                  <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("event.duration")}</p>
                    <p className="mt-1 font-medium">{formatDuration(selectedEvent.startAt, selectedEvent.endAt)}</p>
                    <p className="mt-1 text-xs text-muted">
                      {t("event.allDay")}: {selectedEvent.isAllDay ? t("common.yes") : t("common.no")}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("event.location")}</p>
                    <p className="mt-1 font-medium">{selectedEvent.location}</p>
                  </div>

                  <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("event.organizer")}</p>
                    <p className="mt-1 font-medium">{selectedEvent.organizer ?? selectedEvent.sourceAccount}</p>
                  </div>

                  <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("event.calendar")}</p>
                    <p className="mt-1 font-medium">{selectedEvent.calendarName ?? "Calendar"}</p>
                  </div>

                  <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("event.provider")}</p>
                    <p className="mt-1 font-medium">
                      {selectedEvent.provider === "google"
                        ? t("settings.providerGoogle")
                        : selectedEvent.provider === "microsoft"
                          ? t("settings.providerMicrosoft")
                          : selectedEvent.provider ?? "-"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("event.lastUpdated")}</p>
                    <p className="mt-1 font-medium">
                      {selectedEvent.lastModifiedAt
                        ? new Date(selectedEvent.lastModifiedAt).toLocaleString(intl, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })
                        : "-"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-line bg-white/85 p-3 text-sm">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("event.webLink")}</p>
                    {selectedEvent.webLink ? (
                      <a className="mt-1 inline-flex text-sm font-medium text-accent hover:underline" href={selectedEvent.webLink} rel="noreferrer" target="_blank">
                        {t("event.openOriginal")}
                      </a>
                    ) : (
                      <p className="mt-1 font-medium">-</p>
                    )}
                  </div>
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
