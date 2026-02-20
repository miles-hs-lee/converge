"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { UnifiedWeekCalendar } from "@/components/unified-week-calendar";
import { ModalPortal } from "@/components/modal-portal";
import { EventDetailModal } from "@/components/event-detail-modal";
import { useAppPreferences } from "@/components/app-preferences-provider";
import { useT, useIntlLocale } from "@/components/locale-provider";
import { detectTenantConflicts } from "@/lib/calendar-conflicts";
import { isMockMode } from "@/lib/mock-mode";
import { getNotificationPermissionSafe, sendPwaNotification } from "@/lib/pwa-notifications";

export type CalendarEventRow = {
  id: string;
  tenantName: string;
  subject: string;
  startAt: string;
  endAt: string;
  location: string;
  sourceAccount: string;
  attendees: string[];
  attendeeDetails?: CalendarAttendee[];
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

export type CalendarAttendee = {
  email: string;
  name?: string | null;
  type?: string | null;
  response?: string | null;
  respondedAt?: string | null;
};

type CalendarEventsOverviewProps = {
  events: CalendarEventRow[];
  tenants: string[];
};

type EventVisibilityFilters = {
  includeTentative: boolean;
  includeWorkingElsewhere: boolean;
  includeAwaitingResponse: boolean;
  includeDeclined: boolean;
  includeCancelled: boolean;
};

const EVENT_VISIBILITY_FILTERS_STORAGE_KEY = "converge_calendar_visibility_filters";

const DEFAULT_EVENT_VISIBILITY_FILTERS: EventVisibilityFilters = {
  includeTentative: false,
  includeWorkingElsewhere: false,
  includeAwaitingResponse: false,
  includeDeclined: false,
  includeCancelled: false
};

function safeParseSet(raw: string | null): Set<string> {
  if (!raw) {
    return new Set();
  }
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function parseEventVisibilityFilters(raw: string | null): EventVisibilityFilters {
  if (!raw) {
    return DEFAULT_EVENT_VISIBILITY_FILTERS;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<EventVisibilityFilters> | null;
    if (!parsed || typeof parsed !== "object") {
      return DEFAULT_EVENT_VISIBILITY_FILTERS;
    }
    return {
      includeTentative: parsed.includeTentative === true,
      includeWorkingElsewhere: parsed.includeWorkingElsewhere === true,
      includeAwaitingResponse: parsed.includeAwaitingResponse === true,
      includeDeclined: parsed.includeDeclined === true,
      includeCancelled: parsed.includeCancelled === true
    };
  } catch {
    return DEFAULT_EVENT_VISIBILITY_FILTERS;
  }
}

function passesVisibilityFilters(event: CalendarEventRow, filters: EventVisibilityFilters): boolean {
  const showAs = (event.showAs ?? "").toLowerCase();
  const response = (event.responseStatus ?? "").toLowerCase();

  if (!filters.includeCancelled && event.isCancelled) {
    return false;
  }
  if (!filters.includeTentative && (showAs === "tentative" || response === "tentative")) {
    return false;
  }
  if (!filters.includeWorkingElsewhere && showAs === "workingelsewhere") {
    return false;
  }
  if (!filters.includeAwaitingResponse && response === "notresponded") {
    return false;
  }
  if (!filters.includeDeclined && response === "declined") {
    return false;
  }
  return true;
}

function EventList({
  title,
  events,
  emptyText,
  attendeesLabel,
  intl,
  onOpenEvent,
  onHoverEvent,
  onLeaveEvent
}: {
  title: string;
  events: CalendarEventRow[];
  emptyText: string;
  attendeesLabel: (count: number) => string;
  intl: string;
  onOpenEvent: (event: CalendarEventRow) => void;
  onHoverEvent: (event: CalendarEventRow, el: HTMLElement) => void;
  onLeaveEvent: () => void;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white/85 p-4">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {events.length === 0 ? (
        <p className="muted mt-2">{emptyText}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {events.map((event) => (
            <button
              className="w-full rounded-xl border border-line bg-white p-3 text-left transition hover:border-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
              key={event.id}
              onBlur={onLeaveEvent}
              onClick={() => onOpenEvent(event)}
              onFocus={(evt) => onHoverEvent(event, evt.currentTarget)}
              onMouseEnter={(evt) => onHoverEvent(event, evt.currentTarget)}
              onMouseLeave={onLeaveEvent}
              type="button"
            >
              <p className="text-sm font-medium">{event.subject}</p>
              <p className="mt-1 text-xs text-muted">
                {new Date(event.startAt).toLocaleString(intl)} -{" "}
                {new Date(event.endAt).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })}
              </p>
              <p className="mt-1 text-xs text-muted">
                {event.tenantName} · {event.sourceAccount} · {event.location}
              </p>
              {event.attendees.length > 0 ? (
                <p className="mt-1 text-xs text-muted">{attendeesLabel(event.attendees.length)}</p>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function formatDateTimeRange(startIso: string, endIso: string, intl: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay = start.toDateString() === end.toDateString();

  if (sameDay) {
    return `${start.toLocaleDateString(intl, { month: "short", day: "numeric", weekday: "short" })} ${start.toLocaleTimeString(intl, {
      hour: "2-digit",
      minute: "2-digit"
    })} - ${end.toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })}`;
  }

  return `${start.toLocaleString(intl, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })} - ${end.toLocaleString(intl, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
}

export function CalendarEventsOverview({ events, tenants }: CalendarEventsOverviewProps) {
  const t = useT();
  const intl = useIntlLocale();
  const { getTenantColor } = useAppPreferences();

  // In MOCK mode, allow generating additional conflicts without changing server data.
  const [localEvents, setLocalEvents] = useState<CalendarEventRow[]>(() => events);
  const [query, setQuery] = useState("");
  const [rangeDays, setRangeDays] = useState<3 | 7>(3);
  const [disabledTenants, setDisabledTenants] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [permissionBlocked, setPermissionBlocked] = useState(false);
  const [permissionLabel, setPermissionLabel] = useState<string>("unknown");
  const [lastSentIso, setLastSentIso] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventRow | null>(null);
  const [canHover, setCanHover] = useState(false);
  const [hovered, setHovered] = useState<{ event: CalendarEventRow; rect: DOMRect } | null>(null);
  const [visibilityFilters, setVisibilityFilters] = useState<EventVisibilityFilters>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_EVENT_VISIBILITY_FILTERS;
    }
    return parseEventVisibilityFilters(window.localStorage.getItem(EVENT_VISIBILITY_FILTERS_STORAGE_KEY));
  });
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const enabledTenants = useMemo(() => tenants.filter((tenant) => !disabledTenants.has(tenant)), [disabledTenants, tenants]);

  const visibilityFilteredEvents = useMemo(() => {
    return localEvents.filter((event) => passesVisibilityFilters(event, visibilityFilters));
  }, [localEvents, visibilityFilters]);

  const filteredEvents = useMemo(() => {
    return visibilityFilteredEvents.filter((event) => {
      if (disabledTenants.has(event.tenantName)) {
        return false;
      }

      if (!deferredQuery) {
        return true;
      }

      return (
        event.subject.toLowerCase().includes(deferredQuery) ||
        event.location.toLowerCase().includes(deferredQuery) ||
        event.tenantName.toLowerCase().includes(deferredQuery) ||
        event.sourceAccount.toLowerCase().includes(deferredQuery) ||
        event.attendees.some((attendee) => attendee.toLowerCase().includes(deferredQuery))
      );
    });
  }, [deferredQuery, disabledTenants, visibilityFilteredEvents]);

  const eventsById = useMemo(() => {
    return new Map(localEvents.map((event) => [event.id, event]));
  }, [localEvents]);

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

  const conflictEvents = useMemo(() => {
    // Conflicts should not be affected by search query; only the tenant toggles.
    return visibilityFilteredEvents.filter((event) => !disabledTenants.has(event.tenantName));
  }, [disabledTenants, visibilityFilteredEvents]);
  const deferredConflictEvents = useDeferredValue(conflictEvents);

  const conflicts = useMemo(() => {
    return detectTenantConflicts(
      deferredConflictEvents.map((event) => ({
        id: event.id,
        tenantName: event.tenantName,
        subject: event.subject,
        startAt: event.startAt,
        endAt: event.endAt,
        location: event.location,
        sourceAccount: event.sourceAccount
      }))
    );
  }, [deferredConflictEvents]);

  useEffect(() => {
    setLocalEvents(events);
  }, [events]);

  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    return safeParseSet(localStorage.getItem("converge_conflicts_dismissed"));
  });

  const visibleConflicts = useMemo(() => conflicts.filter((c) => !dismissedKeys.has(c.key)), [conflicts, dismissedKeys]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("converge_notifications_enabled");
    setNotificationsEnabled(stored === "true");
    try {
      setPermissionBlocked(Boolean(window.Notification) && Notification.permission === "denied");
    } catch {
      setPermissionBlocked(false);
    }
    setPermissionLabel(String(getNotificationPermissionSafe()));
    setLastSentIso(localStorage.getItem("converge_notifications_last_sent"));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const seen = safeParseSet(localStorage.getItem("converge_conflicts_seen"));
    const unseen = visibleConflicts.filter((c) => !seen.has(c.key));
    if (unseen.length === 0) return;

    // Mark as seen.
    unseen.forEach((c) => seen.add(c.key));
    localStorage.setItem("converge_conflicts_seen", JSON.stringify([...seen]));

    // In-app banner/toast.
    setToast(t("alerts.banner", { count: unseen.length }));
    const timer = window.setTimeout(() => setToast(null), 4200);

    // Optional PWA/system notification (requires user opt-in + permission granted).
    if (notificationsEnabled) {
      const first = unseen[0]!;
      try {
        const overlapStart = new Date(first.overlapStart).toLocaleString(intl, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
        const overlapEnd = new Date(first.overlapEnd).toLocaleString(intl, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
        const title = t("alerts.notificationTitle", { count: unseen.length });
        const body = t("alerts.notificationBody", {
          a: first.a.tenantName,
          b: first.b.tenantName,
          start: overlapStart,
          end: overlapEnd
        });

        void sendPwaNotification({ title, body, url: "/calendar", tag: "converge-conflict" }).then((res) => {
          if (res.ok && typeof window !== "undefined") {
            const nowIso = new Date().toISOString();
            localStorage.setItem("converge_notifications_last_sent", nowIso);
            setLastSentIso(nowIso);
          }
        });
      } catch {
        // ignore
      }
    }

    return () => window.clearTimeout(timer);
  }, [intl, notificationsEnabled, t, visibleConflicts]);

  async function enableNotifications() {
    if (typeof window === "undefined" || typeof window.Notification === "undefined") {
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionLabel(permission);
      if (permission === "granted") {
        localStorage.setItem("converge_notifications_enabled", "true");
        setNotificationsEnabled(true);
        setPermissionBlocked(false);
        // Confirm to the user that notifications actually show up.
        const title = "Converge";
        const body = t("alerts.test");
        const res = await sendPwaNotification({ title, body, url: "/settings", tag: "converge-test" });
        if (res.ok) {
          const nowIso = new Date().toISOString();
          localStorage.setItem("converge_notifications_last_sent", nowIso);
          setLastSentIso(nowIso);
        }
        return;
      }
      if (permission === "denied") {
        setPermissionBlocked(true);
      }
    } catch {
      // ignore
    }
  }

  function disableNotifications() {
    if (typeof window === "undefined") return;
    localStorage.setItem("converge_notifications_enabled", "false");
    setNotificationsEnabled(false);
  }

  function dismissConflict(key: string) {
    setDismissedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      if (typeof window !== "undefined") {
        localStorage.setItem("converge_conflicts_dismissed", JSON.stringify([...next]));
      }
      return next;
    });
  }

  function rescan() {
    if (typeof window === "undefined") return;
    // Make existing conflicts "new" again for testing.
    localStorage.removeItem("converge_conflicts_seen");
    setToast(t("alerts.banner", { count: visibleConflicts.length }));
    window.setTimeout(() => setToast(null), 2600);
  }

  function simulateMockConflict() {
    if (!isMockMode) return;

    const base = new Date();
    base.setSeconds(0, 0);

    const start = new Date(base);
    start.setMinutes(start.getMinutes() + 5);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30);

    const tenant = enabledTenants.find((name) => name !== enabledTenants[0]) ?? enabledTenants[0] ?? "Mock Tenant";
    const id = `evt-sim-${Date.now()}`;

    setLocalEvents((prev) => [
      ...prev,
      {
        id,
        tenantName: tenant,
        subject: `Simulated overlap · ${tenant}`,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        location: "Teams",
        sourceAccount: `you@${tenant.replace(/\s+/g, "").toLowerCase()}.example.com`,
        attendees: ["test@example.com"]
      }
    ]);
  }

  function toggleVisibilityFilter(key: keyof EventVisibilityFilters) {
    setVisibilityFilters((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (typeof window !== "undefined") {
        localStorage.setItem(EVENT_VISIBILITY_FILTERS_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  }

  function openEvent(event: CalendarEventRow) {
    closeHover();
    setSelectedEvent(event);
  }

  function closeEventModal() {
    setSelectedEvent(null);
  }

  function openHover(event: CalendarEventRow, el: HTMLElement) {
    if (!canHover) return;
    setHovered({ event, rect: el.getBoundingClientRect() });
  }

  function closeHover() {
    setHovered(null);
  }

  function conflictEventToRow(event: { id: string; tenantName: string; subject: string; startAt: string; endAt: string; location?: string; sourceAccount?: string }): CalendarEventRow {
    return (
      eventsById.get(event.id) ?? {
        id: event.id,
        tenantName: event.tenantName,
        subject: event.subject,
        startAt: event.startAt,
        endAt: event.endAt,
        location: event.location ?? t("common.locationUnknown"),
        sourceAccount: event.sourceAccount ?? t("common.unknownAccount"),
        attendees: []
      }
    );
  }

  return (
    <>
      {toast ? (
        <div className="sticky top-3 z-20">
          <div className="rounded-2xl border border-accent/35 bg-white/90 p-3 text-sm shadow-soft">
            <span className="font-medium text-text">{toast}</span>
          </div>
        </div>
      ) : null}

      <div className="mt-1 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <input
            className="input-control pl-11"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("calendar.searchPlaceholder")}
            type="search"
            value={query}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          aria-pressed={visibilityFilters.includeTentative}
          className={`badge transition ${visibilityFilters.includeTentative ? "border-accent/50 bg-accent/10 text-accent" : "bg-white/90 text-muted"}`}
          onClick={() => toggleVisibilityFilter("includeTentative")}
          type="button"
        >
          {t("calendar.filter.includeTentative")}
        </button>
        <button
          aria-pressed={visibilityFilters.includeWorkingElsewhere}
          className={`badge transition ${visibilityFilters.includeWorkingElsewhere ? "border-accent/50 bg-accent/10 text-accent" : "bg-white/90 text-muted"}`}
          onClick={() => toggleVisibilityFilter("includeWorkingElsewhere")}
          type="button"
        >
          {t("calendar.filter.includeWorkingElsewhere")}
        </button>
        <button
          aria-pressed={visibilityFilters.includeAwaitingResponse}
          className={`badge transition ${visibilityFilters.includeAwaitingResponse ? "border-accent/50 bg-accent/10 text-accent" : "bg-white/90 text-muted"}`}
          onClick={() => toggleVisibilityFilter("includeAwaitingResponse")}
          type="button"
        >
          {t("calendar.filter.includeAwaitingResponse")}
        </button>
        <button
          aria-pressed={visibilityFilters.includeDeclined}
          className={`badge transition ${visibilityFilters.includeDeclined ? "border-accent/50 bg-accent/10 text-accent" : "bg-white/90 text-muted"}`}
          onClick={() => toggleVisibilityFilter("includeDeclined")}
          type="button"
        >
          {t("calendar.filter.includeDeclined")}
        </button>
        <button
          aria-pressed={visibilityFilters.includeCancelled}
          className={`badge transition ${visibilityFilters.includeCancelled ? "border-accent/50 bg-accent/10 text-accent" : "bg-white/90 text-muted"}`}
          onClick={() => toggleVisibilityFilter("includeCancelled")}
          type="button"
        >
          {t("calendar.filter.includeCancelled")}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {tenants.map((tenant) => {
          const enabled = !disabledTenants.has(tenant);
          const color = getTenantColor(tenant);
          return (
            <button
              aria-pressed={enabled}
              className={`badge gap-2 bg-white/90 transition hover:border-accent/45 ${enabled ? "" : "opacity-45 line-through"}`}
              key={tenant}
              onClick={() => {
                setDisabledTenants((prev) => {
                  const next = new Set(prev);
                  if (next.has(tenant)) {
                    next.delete(tenant);
                  } else {
                    next.add(tenant);
                  }
                  return next;
                });
              }}
              type="button"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
              {tenant}
            </button>
          );
        })}
      </div>

      <UnifiedWeekCalendar events={filteredEvents} tenants={enabledTenants} />

      <section className="panel-glass card mt-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="title-lg">{t("calendar.rangeTitle")}</h2>
            <p className="muted mt-1">{t("calendar.rangeCurrent", { days: rangeDays })}</p>
          </div>
          <div className="inline-flex rounded-xl border border-line bg-white/90 p-0.5">
            <button
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${rangeDays === 3 ? "bg-accent text-white" : "text-slate-700"}`}
              onClick={() => setRangeDays(3)}
              type="button"
            >
              {t("calendar.range3")}
            </button>
            <button
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${rangeDays === 7 ? "bg-accent text-white" : "text-slate-700"}`}
              onClick={() => setRangeDays(7)}
              type="button"
            >
              {t("calendar.range7")}
            </button>
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <EventList
            attendeesLabel={(count) => t("calendar.attendeesCount", { count })}
            emptyText={t("calendar.none")}
            events={pastEvents}
            intl={intl}
            onHoverEvent={openHover}
            onLeaveEvent={closeHover}
            onOpenEvent={openEvent}
            title={t("calendar.past")}
          />
          <EventList
            attendeesLabel={(count) => t("calendar.attendeesCount", { count })}
            emptyText={t("calendar.none")}
            events={upcomingEvents}
            intl={intl}
            onHoverEvent={openHover}
            onLeaveEvent={closeHover}
            onOpenEvent={openEvent}
            title={t("calendar.upcoming")}
          />
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-white/85 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold tracking-tight">{t("alerts.title")}</h3>
            <p className="muted mt-1">{t("alerts.subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge">{t("alerts.count", { count: visibleConflicts.length })}</span>
            <button className="btn btn-secondary px-3 py-1.5" onClick={rescan} type="button">
              {t("alerts.rescan")}
            </button>
            {isMockMode ? (
              <button className="btn btn-secondary px-3 py-1.5" onClick={simulateMockConflict} type="button">
                {t("alerts.simulate")}
              </button>
            ) : null}
            <button
              className="btn btn-secondary px-3 py-1.5"
              onClick={async () => {
                const title = "Converge";
                const body = t("alerts.test");
                const res = await sendPwaNotification({ title, body, url: "/calendar", tag: "converge-test" });
                if (res.ok && typeof window !== "undefined") {
                  const nowIso = new Date().toISOString();
                  localStorage.setItem("converge_notifications_last_sent", nowIso);
                  setLastSentIso(nowIso);
                  setToast(t("alerts.test"));
                  window.setTimeout(() => setToast(null), 1800);
                }
              }}
              type="button"
            >
              {t("alerts.test")}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {permissionBlocked ? <span className="text-xs text-rose-700">{t("alerts.permissionDenied")}</span> : null}
          <span className="text-xs text-muted">{t("alerts.permission", { value: permissionLabel })}</span>
          {lastSentIso ? (
            <span className="text-xs text-muted">{t("alerts.lastSent", { value: new Date(lastSentIso).toLocaleString(intl) })}</span>
          ) : null}
          {notificationsEnabled ? (
            <button className="btn btn-secondary px-3 py-1.5" onClick={disableNotifications} type="button">
              {t("alerts.disableNotifications")}
            </button>
          ) : (
            <button className="btn btn-primary px-3 py-1.5" onClick={enableNotifications} type="button">
              {t("alerts.enableNotifications")}
            </button>
          )}
        </div>

        {visibleConflicts.length === 0 ? (
          <p className="muted mt-3">{t("alerts.none")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {visibleConflicts.slice(0, 8).map((conflict) => {
              const aColor = getTenantColor(conflict.a.tenantName);
              const bColor = getTenantColor(conflict.b.tenantName);
              const overlap = formatDateTimeRange(conflict.overlapStart, conflict.overlapEnd, intl);
              const eventA = conflictEventToRow(conflict.a);
              const eventB = conflictEventToRow(conflict.b);

              return (
                <article className="rounded-xl border border-line bg-white p-3" key={conflict.key}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-muted">{overlap}</p>
                      <button
                        className="mt-1 block text-left text-sm font-semibold text-text hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                        onBlur={closeHover}
                        onClick={() => openEvent(eventA)}
                        onFocus={(event) => openHover(eventA, event.currentTarget)}
                        onMouseEnter={(event) => openHover(eventA, event.currentTarget)}
                        onMouseLeave={closeHover}
                        type="button"
                      >
                        {eventA.subject}
                      </button>
                      <button
                        className="mt-1 block text-left text-sm font-semibold text-text hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                        onBlur={closeHover}
                        onClick={() => openEvent(eventB)}
                        onFocus={(event) => openHover(eventB, event.currentTarget)}
                        onMouseEnter={(event) => openHover(eventB, event.currentTarget)}
                        onMouseLeave={closeHover}
                        type="button"
                      >
                        {eventB.subject}
                      </button>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1" style={{ color: aColor }}>
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: aColor }} />
                          {eventA.tenantName}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1" style={{ color: bColor }}>
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: bColor }} />
                          {eventB.tenantName}
                        </span>
                      </div>
                    </div>

                    <button className="btn btn-secondary px-3 py-1.5" onClick={() => dismissConflict(conflict.key)} type="button">
                      {t("alerts.dismiss")}
                    </button>
                  </div>
                </article>
              );
            })}
            {visibleConflicts.length > 8 ? <p className="muted text-xs">{t("common.more", { count: visibleConflicts.length - 8 })}</p> : null}
          </div>
        )}
      </section>

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
            const timeLine = formatDateTimeRange(hovered.event.startAt, hovered.event.endAt, intl);

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

      <EventDetailModal event={selectedEvent} onClose={closeEventModal} />
    </>
  );
}
