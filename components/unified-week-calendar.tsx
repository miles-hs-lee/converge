"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { useAppPreferences } from "@/components/app-preferences-provider";
import { useIntlLocale, useT } from "@/components/locale-provider";
import { trackClientEvent } from "@/lib/analytics/client";
import { analyticsEvents } from "@/lib/analytics/events";

const EventDetailModal = dynamic(() => import("@/components/event-detail-modal").then((mod) => mod.EventDetailModal), {
  loading: () => null,
  ssr: false
});

type CalendarEvent = {
  id: string;
  tenantName: string;
  subject: string;
  startAt: string;
  endAt: string;
  location: string;
  sourceAccount: string;
  attendees: string[];
  attendeeDetails?: Array<{
    email: string;
    name?: string | null;
    type?: string | null;
    response?: string | null;
    respondedAt?: string | null;
  }>;
  organizer?: string;
  organizerName?: string | null;
  isAllDay?: boolean;
  webLink?: string | null;
  lastModifiedAt?: string | null;
  createdAt?: string | null;
  calendarName?: string;
  provider?: string;
  bodyPreview?: string | null;
  importance?: string | null;
  sensitivity?: string | null;
  showAs?: string | null;
  responseStatus?: string | null;
  responseTime?: string | null;
  isCancelled?: boolean;
  isOnlineMeeting?: boolean;
  onlineMeetingUrl?: string | null;
  eventType?: string | null;
  categories?: string[];
  timezoneStart?: string | null;
  timezoneEnd?: string | null;
};

type UnifiedWeekCalendarProps = {
  events: CalendarEvent[];
  tenants: string[];
};

type ViewMode = "day" | "workweek" | "week" | "month";
type WeekStart = "sun" | "mon";

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

function startOfWeek(date: Date, weekStart: WeekStart): Date {
  const result = new Date(date);
  const day = result.getDay();
  const distanceFromWeekStart = weekStart === "sun" ? day : day === 0 ? 6 : day - 1;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - distanceFromWeekStart);
  return result;
}

function startOfWorkWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - distanceFromMonday);
  return result;
}

function startOfMonthGrid(date: Date, weekStart: WeekStart): Date {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfWeek(first, weekStart);
}

function rangeLabel(start: Date, days: number, intl: string): string {
  const end = addDays(start, days - 1);
  return `${start.toLocaleDateString(intl, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(intl, {
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

function dayKeysForRange(startTs: number, endTs: number): Array<{ key: string; dayStartTs: number }> {
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) {
    return [];
  }

  const start = startOfDay(new Date(startTs));
  // End is exclusive; if it lands exactly on 00:00, include the previous day only.
  const inclusiveEndTs = Math.max(startTs, endTs - 1);
  const end = startOfDay(new Date(inclusiveEndTs));
  const out: Array<{ key: string; dayStartTs: number }> = [];

  for (let cursor = new Date(start); cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
    out.push({
      key: dayKey(cursor),
      dayStartTs: cursor.getTime()
    });
  }

  return out;
}

function dayKeysForAllDayRange(startTs: number, endTs: number): Array<{ key: string; dayStartTs: number }> {
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) {
    return [];
  }

  const startDay = startOfDay(new Date(startTs));
  const diffMs = endTs - startTs;
  // All-day events should follow day-count semantics, not local clock boundaries.
  const spanDays = Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)));
  const out: Array<{ key: string; dayStartTs: number }> = [];

  for (let i = 0; i < spanDays; i += 1) {
    const day = addDays(startDay, i);
    out.push({
      key: dayKey(day),
      dayStartTs: day.getTime()
    });
  }

  return out;
}

function isUnconfirmedEvent(event: Pick<CalendarEvent, "showAs" | "responseStatus">): boolean {
  const showAs = (event.showAs ?? "").trim().toLowerCase();
  const response = (event.responseStatus ?? "").trim().toLowerCase();
  return showAs === "tentative" || response === "tentative" || response === "tentativelyaccepted" || response === "notresponded";
}

export function UnifiedWeekCalendar({ events, tenants: _tenants }: UnifiedWeekCalendarProps) {
  const t = useT();
  const intl = useIntlLocale();
  const { getTenantColor, calendarWeekStart } = useAppPreferences();

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [offsetDay, setOffsetDay] = useState(0);
  const [offsetWorkWeek, setOffsetWorkWeek] = useState(0);
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

  const workWeekStart = useMemo(() => {
    const base = startOfWorkWeek(new Date());
    return addDays(base, offsetWorkWeek * 7);
  }, [offsetWorkWeek]);

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date(), calendarWeekStart);
    return addDays(base, offsetWeek * 7);
  }, [calendarWeekStart, offsetWeek]);

  const monthDate = useMemo(() => {
    const base = new Date();
    return new Date(base.getFullYear(), base.getMonth() + offsetMonth, 1);
  }, [offsetMonth]);

  const workWeekDays = useMemo(() => Array.from({ length: 5 }, (_, idx) => addDays(workWeekStart, idx)), [workWeekStart]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx)), [weekStart]);
  const monthDays = useMemo(() => {
    const start = startOfMonthGrid(monthDate, calendarWeekStart);
    return Array.from({ length: 42 }, (_, idx) => addDays(start, idx));
  }, [calendarWeekStart, monthDate]);

  const eventRows = useMemo(() => {
    return events
      .map((event) => {
        const startTs = new Date(event.startAt).getTime();
        const endTs = new Date(event.endAt).getTime();
        if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) {
          return null;
        }
        return {
          event,
          startTs,
          endTs
        };
      })
      .filter((row): row is { event: CalendarEvent; startTs: number; endTs: number } => Boolean(row));
  }, [events]);

  const eventsById = useMemo(() => {
    return new Map(events.map((event) => [event.id, event]));
  }, [events]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const rowMap = new Map<string, Array<{ event: CalendarEvent; startTs: number }>>();

    eventRows.forEach((row) => {
      const keys = row.event.isAllDay ? dayKeysForAllDayRange(row.startTs, row.endTs) : dayKeysForRange(row.startTs, row.endTs);
      keys.forEach(({ key, dayStartTs }) => {
        const existing = rowMap.get(key) ?? [];
        existing.push({ event: row.event, startTs: Math.max(row.startTs, dayStartTs) });
        rowMap.set(key, existing);
      });
    });

    rowMap.forEach((rows, key) => {
      rows.sort((a, b) => a.startTs - b.startTs);
      map.set(
        key,
        rows.map((row) => row.event)
      );
    });

    return map;
  }, [eventRows]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) {
      return null;
    }
    return eventsById.get(selectedEventId) ?? null;
  }, [eventsById, selectedEventId]);

  const moreEvents = useMemo(() => {
    if (!moreDayKeyValue) {
      return [];
    }
    return eventsByDay.get(moreDayKeyValue) ?? [];
  }, [eventsByDay, moreDayKeyValue]);

  const label =
    viewMode === "day"
      ? dayLabel(dayDate, intl)
      : viewMode === "workweek"
        ? rangeLabel(workWeekStart, 5, intl)
        : viewMode === "week"
          ? rangeLabel(weekStart, 7, intl)
          : monthLabel(monthDate, intl);

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
    if (viewMode === "workweek") {
      setOffsetWorkWeek((prev) => prev - 1);
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
    setOffsetWorkWeek(0);
    setOffsetWeek(0);
    setOffsetMonth(0);
  }

  function goNext() {
    if (viewMode === "day") {
      setOffsetDay((prev) => prev + 1);
      return;
    }
    if (viewMode === "workweek") {
      setOffsetWorkWeek((prev) => prev + 1);
      return;
    }
    if (viewMode === "week") {
      setOffsetWeek((prev) => prev + 1);
      return;
    }
    setOffsetMonth((prev) => prev + 1);
  }

  function openEvent(eventId: string) {
    const event = eventsById.get(eventId);
    if (event) {
      void trackClientEvent(analyticsEvents.calendarEventOpened, {
        source: "calendar_grid",
        eventId: event.id,
        tenantName: event.tenantName,
        provider: event.provider ?? "unknown",
        isAllDay: Boolean(event.isAllDay)
      });
    }
    setSelectedEventId(eventId);
  }

  function switchViewMode(nextViewMode: ViewMode) {
    if (nextViewMode === viewMode) {
      return;
    }
    void trackClientEvent(analyticsEvents.calendarViewModeChanged, {
      from: viewMode,
      to: nextViewMode
    });
    setViewMode(nextViewMode);
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
    const ordered = calendarWeekStart === "sun" ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
    return ordered.map((dayOfWeek) => ({
      dayOfWeek,
      label:
        dayOfWeek === 0
          ? t("weekday.sun")
          : dayOfWeek === 1
            ? t("weekday.mon")
            : dayOfWeek === 2
              ? t("weekday.tue")
              : dayOfWeek === 3
                ? t("weekday.wed")
                : dayOfWeek === 4
                  ? t("weekday.thu")
                  : dayOfWeek === 5
                    ? t("weekday.fri")
                    : t("weekday.sat")
    }));
  }, [calendarWeekStart, t]);

  const visibleWeekDays = viewMode === "workweek" ? workWeekDays : weekDays;

  const dayEvents = useMemo(() => {
    const dayStart = startOfDay(dayDate);
    const startTs = dayStart.getTime();
    const endTs = startTs + 24 * 60 * 60 * 1000;

    return eventRows
      .filter((row) => row.startTs < endTs && row.endTs > startTs)
      .sort((a, b) => a.startTs - b.startTs)
      .map((row) => row.event);
  }, [dayDate, eventRows]);

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
                onClick={() => switchViewMode("day")}
                type="button"
              >
                {t("common.day")}
              </button>
              <button
                className={`rounded-lg px-3 py-1.5 font-medium ${viewMode === "workweek" ? "bg-accent text-white" : "text-slate-700"}`}
                onClick={() => switchViewMode("workweek")}
                type="button"
              >
                {t("common.workWeek")}
              </button>
              <button
                className={`rounded-lg px-3 py-1.5 font-medium ${viewMode === "week" ? "bg-accent text-white" : "text-slate-700"}`}
                onClick={() => switchViewMode("week")}
                type="button"
              >
                {t("common.week")}
              </button>
              <button
                className={`rounded-lg px-3 py-1.5 font-medium ${viewMode === "month" ? "bg-accent text-white" : "text-slate-700"}`}
                onClick={() => switchViewMode("month")}
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
                      const color = getTenantColor(event.tenantName);
                      const unconfirmed = isUnconfirmedEvent(event);
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
                          className={`absolute rounded-xl border text-left shadow-soft transition hover:border-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
                            unconfirmed ? "border-dashed border-amber-300/80 bg-amber-50/70" : "border-line bg-white"
                          } ${
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
        ) : viewMode === "week" || viewMode === "workweek" ? (
          <div className={`grid gap-2 ${viewMode === "workweek" ? "md:grid-cols-5" : "md:grid-cols-7"}`}>
            {visibleWeekDays.map((day) => {
              const key = dayKey(day);
              const dailyEvents = eventsByDay.get(key) ?? [];
              const isToday = sameDate(day, new Date());
              return (
                <section
                  className={`min-h-44 rounded-xl border p-2 ${
                    isToday ? "border-accent/60 bg-accent/5 shadow-[0_0_0_1px_rgba(8,145,178,0.18)]" : "border-line bg-white/90"
                  }`}
                  key={key}
                >
                  <header className={`mb-2 pb-2 ${isToday ? "border-b border-accent/30" : "border-b border-line"}`}>
                    <p className="text-xs uppercase tracking-[0.14em] text-muted">{day.toLocaleDateString(intl, { weekday: "short" })}</p>
                    <p
                      className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-sm font-semibold ${
                        isToday ? "bg-accent/15 text-accent" : dateNumberClass(day, isToday)
                      }`}
                    >
                      {day.toLocaleDateString(intl, { month: "numeric", day: "numeric" })}
                    </p>
                  </header>

                  <div className="space-y-2">
                    {dailyEvents.slice(0, inlineLimitWeek).map((event) => {
                      const color = getTenantColor(event.tenantName);
                      const unconfirmed = isUnconfirmedEvent(event);
                      return (
                        <button
                          className={`w-full rounded-lg border p-2 text-left transition hover:border-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
                            unconfirmed ? "border-dashed border-amber-300/80 bg-amber-50/70" : "border-line bg-white"
                          }`}
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
                            {event.isAllDay ? t("event.allDay") : new Date(event.startAt).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <div
                            className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{ backgroundColor: `${color}1f`, color }}
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                            <span className="min-w-0 truncate">{event.tenantName}</span>
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
                {weekdayLabels.map((weekday) => {
                  const weekendClass = weekday.dayOfWeek === 6 ? "text-sky-600" : weekday.dayOfWeek === 0 ? "text-rose-600" : "";
                  return (
                    <p className={weekendClass} key={`weekday-${weekday.dayOfWeek}`}>
                      {weekday.label}
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
                    <section
                      className={`min-h-28 rounded-xl border p-2 ${
                        isToday ? "border-accent/60 bg-accent/5 shadow-[0_0_0_1px_rgba(8,145,178,0.18)]" : "border-line bg-white/90"
                      }`}
                      key={key}
                    >
                      <p
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isToday ? "bg-accent/15 text-accent" : dateNumberClass(day, isToday, inCurrentMonth)
                        }`}
                      >
                        {day.getDate()}
                      </p>
                      <div className="mt-2 space-y-1">
                        {dailyEvents.slice(0, inlineLimitMonth).map((event) => {
                          const color = getTenantColor(event.tenantName);
                          const unconfirmed = isUnconfirmedEvent(event);
                          return (
                            <button
                              className={`block w-full truncate rounded-md border px-1.5 py-1 text-left text-[11px] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
                                unconfirmed ? "border-dashed border-amber-300/80" : "border-transparent"
                              }`}
                              key={event.id}
                              onClick={() => openEvent(event.id)}
                              onFocus={(e) => openHover(event, e.currentTarget)}
                              onBlur={closeHover}
                              onMouseEnter={(e) => openHover(event, e.currentTarget)}
                              onMouseLeave={closeHover}
                              style={{ backgroundColor: `${color}1f`, color }}
                              type="button"
                            >
                              {event.isAllDay ? `${t("event.allDay")} ${event.subject}` : `${new Date(event.startAt).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })} ${event.subject}`}
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
                          <p className="mt-1 line-clamp-1 text-xs font-semibold">{hovered.event.calendarName ?? t("event.defaultCalendar")}</p>
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
                <button
                  aria-label={t("common.close")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white/80 text-muted transition hover:border-accent/45 hover:text-accent"
                  onClick={closeMore}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {moreEvents.map((event) => {
                  const color = getTenantColor(event.tenantName);
                  const unconfirmed = isUnconfirmedEvent(event);
                  return (
                    <button
                      className={`w-full rounded-xl border p-3 text-left transition hover:border-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${
                        unconfirmed ? "border-dashed border-amber-300/80 bg-amber-50/70" : "border-line bg-white/90"
                      }`}
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
                            {event.isAllDay
                              ? t("event.allDay")
                              : `${new Date(event.startAt).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })} - ${new Date(event.endAt).toLocaleTimeString(intl, {
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}`}
                          </p>
                          <p className="mt-1 text-xs text-muted">{event.location}</p>
                        </div>
                        <div
                          className="inline-flex max-w-[180px] items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: `${color}1f`, color }}
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                          <span className="min-w-0 truncate">{event.tenantName}</span>
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

      <EventDetailModal event={selectedEvent} onClose={closeEventModal} />
    </>
  );
}
