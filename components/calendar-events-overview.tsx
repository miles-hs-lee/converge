"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Search, X } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { EventDetailModal } from "@/components/event-detail-modal";
import { useAppPreferences } from "@/components/app-preferences-provider";
import { useT, useIntlLocale } from "@/components/locale-provider";
import { detectTenantConflicts } from "@/lib/calendar-conflicts";
import { isMockMode } from "@/lib/mock-mode";
import { getNotificationPermissionSafe, sendPwaNotification } from "@/lib/pwa-notifications";
import { trackClientEvent } from "@/lib/analytics/client";
import { analyticsEvents } from "@/lib/analytics/events";

const UnifiedWeekCalendar = dynamic(() => import("@/components/unified-week-calendar").then((mod) => mod.UnifiedWeekCalendar), {
  ssr: false,
  loading: () => <div className="mt-5 rounded-2xl border border-line bg-white/78 p-4 text-sm text-muted">Loading calendar...</div>
});

export type CalendarEventRow = {
  id: string;
  calendarSourceId?: string;
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
  detailLoaded?: boolean;
};

export type CalendarAttendee = {
  email: string;
  name?: string | null;
  type?: string | null;
  response?: string | null;
  respondedAt?: string | null;
};

export type CalendarSourceRow = {
  id: string;
  tenantName: string;
  name: string;
  isSelected: boolean;
  provider?: string;
};

type CalendarEventsOverviewProps = {
  events: CalendarEventRow[];
  tenants: string[];
  calendarSources?: CalendarSourceRow[];
  showCalendar?: boolean;
  showRangeOverview?: boolean;
  showConflicts?: boolean;
  lazyEventDetail?: boolean;
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
  hydrated,
  onOpenEvent,
  onHoverEvent,
  onLeaveEvent
}: {
  title: string;
  events: CalendarEventRow[];
  emptyText: string;
  attendeesLabel: (count: number) => string;
  intl: string;
  hydrated: boolean;
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
                {hydrated
                  ? `${new Date(event.startAt).toLocaleString(intl)} - ${new Date(event.endAt).toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })}`
                  : `${event.startAt} - ${event.endAt}`}
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

function formatDateTimeRange(startIso: string, endIso: string, intl: string, hydrated: boolean): string {
  if (!hydrated) {
    return `${startIso} - ${endIso}`;
  }

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

export function CalendarEventsOverview({
  events,
  tenants,
  calendarSources = [],
  showCalendar = true,
  showRangeOverview = true,
  showConflicts = true,
  lazyEventDetail = false
}: CalendarEventsOverviewProps) {
  const router = useRouter();
  const pathname = usePathname();
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
  const [nowMarker, setNowMarker] = useState<number>(0);
  const [showAllConflicts, setShowAllConflicts] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventRow | null>(null);
  const [detailLoadingEventId, setDetailLoadingEventId] = useState<string | null>(null);
  const [canHover, setCanHover] = useState(false);
  const [hovered, setHovered] = useState<{ event: CalendarEventRow; rect: DOMRect } | null>(null);
  const [visibilityModalOpen, setVisibilityModalOpen] = useState(false);
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [sourceSelection, setSourceSelection] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(calendarSources.map((source) => [source.id, source.isSelected]))
  );
  const [savingSourceId, setSavingSourceId] = useState<string | null>(null);
  const [visibilityFilters, setVisibilityFilters] = useState<EventVisibilityFilters>(DEFAULT_EVENT_VISIBILITY_FILTERS);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const lastTrackedSearchKeyRef = useRef<string>("");
  const selectedSourceIds = useMemo(
    () => new Set(Object.entries(sourceSelection).filter(([, selected]) => selected).map(([sourceId]) => sourceId)),
    [sourceSelection]
  );

  const enabledTenants = useMemo(() => tenants.filter((tenant) => !disabledTenants.has(tenant)), [disabledTenants, tenants]);
  const activeVisibilityFilterCount = useMemo(() => Object.values(visibilityFilters).filter(Boolean).length, [visibilityFilters]);

  const visibilityFilteredEvents = useMemo(() => {
    return localEvents.filter((event) => passesVisibilityFilters(event, visibilityFilters));
  }, [localEvents, visibilityFilters]);

  const filteredEvents = useMemo(() => {
    return visibilityFilteredEvents.filter((event) => {
      if (calendarSources.length > 0 && event.calendarSourceId && !selectedSourceIds.has(event.calendarSourceId)) {
        return false;
      }

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
  }, [calendarSources.length, deferredQuery, disabledTenants, selectedSourceIds, visibilityFilteredEvents]);

  useEffect(() => {
    if (!deferredQuery) {
      return;
    }
    const key = `${deferredQuery}|${filteredEvents.length}|${enabledTenants.length}|${selectedSourceIds.size}`;
    if (lastTrackedSearchKeyRef.current === key) {
      return;
    }
    lastTrackedSearchKeyRef.current = key;
    void trackClientEvent(analyticsEvents.calendarSearchSubmitted, {
      queryLength: deferredQuery.length,
      resultsCount: filteredEvents.length,
      enabledTenantCount: enabledTenants.length,
      selectedSourceCount: selectedSourceIds.size
    });
  }, [deferredQuery, enabledTenants.length, filteredEvents.length, selectedSourceIds.size]);

  const eventsById = useMemo(() => {
    return new Map(localEvents.map((event) => [event.id, event]));
  }, [localEvents]);

  const pastEvents = useMemo(() => {
    if (!showRangeOverview || !hydrated) return [];
    const nowTs = Date.now();
    const rangeMs = rangeDays * 24 * 60 * 60 * 1000;
    return [...filteredEvents]
      .filter((event) => {
        const end = new Date(event.endAt).getTime();
        return end < nowTs && end >= nowTs - rangeMs;
      })
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
      .slice(0, 8);
  }, [filteredEvents, hydrated, rangeDays, showRangeOverview]);

  const upcomingEvents = useMemo(() => {
    if (!showRangeOverview || !hydrated) return [];
    const nowTs = Date.now();
    const rangeMs = rangeDays * 24 * 60 * 60 * 1000;
    return [...filteredEvents]
      .filter((event) => {
        const start = new Date(event.startAt).getTime();
        return start >= nowTs && start <= nowTs + rangeMs;
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
      .slice(0, 8);
  }, [filteredEvents, hydrated, rangeDays, showRangeOverview]);

  const conflictEvents = useMemo(() => {
    if (!showConflicts) return [];
    // Conflicts should not be affected by search query; only the tenant toggles.
    return visibilityFilteredEvents.filter((event) => {
      if (calendarSources.length > 0 && event.calendarSourceId && !selectedSourceIds.has(event.calendarSourceId)) {
        return false;
      }
      return !disabledTenants.has(event.tenantName);
    });
  }, [calendarSources.length, disabledTenants, selectedSourceIds, showConflicts, visibilityFilteredEvents]);
  const deferredConflictEvents = useDeferredValue(conflictEvents);

  const conflicts = useMemo(() => {
    if (!showConflicts) return [];
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
  }, [deferredConflictEvents, showConflicts]);

  useEffect(() => {
    setLocalEvents(events);
  }, [events]);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setVisibilityFilters(parseEventVisibilityFilters(window.localStorage.getItem(EVENT_VISIBILITY_FILTERS_STORAGE_KEY)));
  }, []);

  useEffect(() => {
    setSourceSelection(Object.fromEntries(calendarSources.map((source) => [source.id, source.isSelected])));
  }, [calendarSources]);

  useEffect(() => {
    setVisibilityModalOpen(false);
    setScopeModalOpen(false);
    setHovered(null);
    setSelectedEvent(null);
  }, [pathname]);

  useEffect(() => {
    if (!visibilityModalOpen && !scopeModalOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setVisibilityModalOpen(false);
        setScopeModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [scopeModalOpen, visibilityModalOpen]);

  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissedKeys(safeParseSet(localStorage.getItem("converge_conflicts_dismissed")));
  }, []);

  const visibleConflicts = useMemo(() => {
    if (!showConflicts) return [];
    return conflicts.filter((c) => {
      if (dismissedKeys.has(c.key)) return false;
      if (nowMarker <= 0) return true;
      const overlapEnd = new Date(c.overlapEnd).getTime();
      return Number.isFinite(overlapEnd) && overlapEnd >= nowMarker;
    });
  }, [conflicts, dismissedKeys, nowMarker, showConflicts]);

  useEffect(() => {
    if (!showConflicts || !hydrated) return;
    setNowMarker(Date.now());
    const timer = window.setInterval(() => {
      setNowMarker(Date.now());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [hydrated, showConflicts]);

  useEffect(() => {
    if (!showConflicts) return;
    if (visibleConflicts.length <= 8) {
      setShowAllConflicts(false);
    }
  }, [showConflicts, visibleConflicts.length]);

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
    if (!showConflicts || !hydrated) return;
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
  }, [hydrated, showConflicts]);

  useEffect(() => {
    if (!showConflicts || !hydrated) return;
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

        void sendPwaNotification({ title, body, url: "/alerts", tag: "converge-conflict" }).then((res) => {
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
  }, [hydrated, intl, notificationsEnabled, showConflicts, t, visibleConflicts]);

  async function enableNotifications() {
    if (typeof window === "undefined" || typeof window.Notification === "undefined") {
      return;
    }

    try {
      const previousPermission = Notification.permission;
      const permission = await Notification.requestPermission();
      setPermissionLabel(permission);
      void trackClientEvent(analyticsEvents.notificationsPermissionChanged, {
        source: "calendar_conflicts",
        previousPermission,
        nextPermission: permission
      });
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

    const tenant = enabledTenants.find((name) => name !== enabledTenants[0]) ?? enabledTenants[0] ?? "Mock Account";
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
    let nextEnabled = false;
    setVisibilityFilters((prev) => {
      nextEnabled = !prev[key];
      const next = { ...prev, [key]: nextEnabled };
      if (typeof window !== "undefined") {
        localStorage.setItem(EVENT_VISIBILITY_FILTERS_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
    void trackClientEvent(analyticsEvents.calendarFilterChanged, {
      filterKey: key,
      enabled: nextEnabled,
      surface: "visibility_modal"
    });
  }

  function openEvent(event: CalendarEventRow, source: string = "calendar_overview") {
    closeHover();
    void trackClientEvent(analyticsEvents.calendarEventOpened, {
      source,
      eventId: event.id,
      tenantName: event.tenantName,
      provider: event.provider ?? "unknown",
      isAllDay: Boolean(event.isAllDay)
    });
    if (source === "conflict_inline") {
      void trackClientEvent(analyticsEvents.conflictsItemOpened, {
        source: "inline",
        eventId: event.id,
        tenantName: event.tenantName,
        provider: event.provider ?? "unknown"
      });
    }
    setSelectedEvent(event);
    if (!lazyEventDetail || event.detailLoaded) {
      return;
    }
    if (detailLoadingEventId === event.id) {
      return;
    }

    const run = async () => {
      setDetailLoadingEventId(event.id);
      try {
        const response = await fetch(`/api/calendar/event?id=${encodeURIComponent(event.id)}`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const json = (await response.json()) as { ok: boolean; item?: CalendarEventRow };
        if (!json.ok || !json.item) {
          return;
        }

        const detail = { ...json.item, detailLoaded: true };
        setLocalEvents((prev) => {
          if (prev.some((row) => row.id === detail.id)) {
            return prev.map((row) => (row.id === detail.id ? { ...row, ...detail } : row));
          }
          return [...prev, detail];
        });
        setSelectedEvent((prev) => (prev?.id === detail.id ? { ...prev, ...detail } : prev));
      } catch {
        // ignore detail load failures; keep summary modal
      } finally {
        setDetailLoadingEventId((current) => (current === event.id ? null : current));
      }
    };

    void run();
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

  function toggleTenant(tenant: string) {
    let tenantVisible = true;
    setDisabledTenants((prev) => {
      const next = new Set(prev);
      if (next.has(tenant)) {
        next.delete(tenant);
      } else {
        next.add(tenant);
      }
      tenantVisible = !next.has(tenant);
      return next;
    });
    void trackClientEvent(analyticsEvents.calendarFilterChanged, {
      filterKey: `tenant:${tenant}`,
      enabled: tenantVisible,
      surface: "scope_modal"
    });
  }

  async function toggleSourceSelection(sourceId: string) {
    const current = Boolean(sourceSelection[sourceId]);
    const next = !current;
    const nextSelection = { ...sourceSelection, [sourceId]: next };
    const selectedCount = Object.values(nextSelection).filter(Boolean).length;
    setSourceSelection((prev) => ({ ...prev, [sourceId]: next }));
    setSavingSourceId(sourceId);

    try {
      const response = await fetch("/api/calendar/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, isSelected: next })
      });
      if (!response.ok) {
        throw new Error("save_failed");
      }
      void trackClientEvent(analyticsEvents.calendarSourcesSaved, {
        sourceId,
        isSelected: next,
        selectedCount,
        sourceCount: calendarSources.length,
        tenantCount: tenants.length
      });
      router.refresh();
    } catch {
      setSourceSelection((prev) => ({ ...prev, [sourceId]: current }));
      setToast(t("calendar.error.saveSourceFailed"));
    } finally {
      setSavingSourceId((currentSaving) => (currentSaving === sourceId ? null : currentSaving));
    }
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
        attendees: [],
        detailLoaded: false
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
        <button className="btn btn-secondary px-3 py-2" onClick={() => setVisibilityModalOpen(true)} type="button">
          {t("calendar.controls.visibility")} {activeVisibilityFilterCount > 0 ? `(${activeVisibilityFilterCount})` : ""}
        </button>
        <button className="btn btn-secondary px-3 py-2" onClick={() => setScopeModalOpen(true)} type="button">
          {t("calendar.controls.scope")}{" "}
          {calendarSources.length > 0 ? `(${selectedSourceIds.size}/${calendarSources.length})` : ""}
        </button>
      </div>

      {showCalendar ? <UnifiedWeekCalendar events={filteredEvents} tenants={enabledTenants} /> : null}

      {showRangeOverview ? (
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
            hydrated={hydrated}
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
            hydrated={hydrated}
            intl={intl}
            onHoverEvent={openHover}
            onLeaveEvent={closeHover}
            onOpenEvent={openEvent}
            title={t("calendar.upcoming")}
          />
        </div>
        </section>
      ) : null}

      {showConflicts ? (
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
                const res = await sendPwaNotification({ title, body, url: "/alerts", tag: "converge-test" });
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
            {(showAllConflicts ? visibleConflicts : visibleConflicts.slice(0, 8)).map((conflict) => {
              const aColor = getTenantColor(conflict.a.tenantName);
              const bColor = getTenantColor(conflict.b.tenantName);
              const overlap = formatDateTimeRange(conflict.overlapStart, conflict.overlapEnd, intl, hydrated);
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
                        onClick={() => openEvent(eventA, "conflict_inline")}
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
                        onClick={() => openEvent(eventB, "conflict_inline")}
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
            {visibleConflicts.length > 8 ? (
              <button
                className="mt-1 inline-flex rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-accent/45 hover:text-accent"
                onClick={() => setShowAllConflicts((prev) => !prev)}
                type="button"
              >
                {showAllConflicts ? t("common.close") : t("common.more", { count: visibleConflicts.length - 8 })}
              </button>
            ) : null}
          </div>
        )}
      </section>
      ) : null}

      {visibilityModalOpen ? (
        <ModalPortal>
          <div className="fixed inset-0 z-[72] flex items-center justify-center bg-slate-900/40 p-3" onClick={() => setVisibilityModalOpen(false)}>
            <section
              className="panel-glass card w-full max-w-md rounded-2xl p-4"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={t("calendar.modal.visibilityTitle")}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold tracking-tight">{t("calendar.modal.visibilityTitle")}</h3>
                <button
                  aria-label={t("common.close")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white/80 text-muted transition hover:border-accent/45 hover:text-accent"
                  onClick={() => setVisibilityModalOpen(false)}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-2">
                {(
                  [
                    ["includeTentative", "calendar.filter.includeTentative"],
                    ["includeWorkingElsewhere", "calendar.filter.includeWorkingElsewhere"],
                    ["includeAwaitingResponse", "calendar.filter.includeAwaitingResponse"],
                    ["includeDeclined", "calendar.filter.includeDeclined"],
                    ["includeCancelled", "calendar.filter.includeCancelled"]
                  ] as const
                ).map(([key, labelKey]) => (
                  <label className="flex items-center gap-3 rounded-xl border border-line bg-white/80 px-3 py-2.5 text-sm" key={key}>
                    <input
                      checked={visibilityFilters[key]}
                      className="h-4 w-4 rounded border-line text-accent focus:ring-accent/40"
                      onChange={() => toggleVisibilityFilter(key)}
                      type="checkbox"
                    />
                    <span>{t(labelKey)}</span>
                  </label>
                ))}
              </div>
            </section>
          </div>
        </ModalPortal>
      ) : null}

      {scopeModalOpen ? (
        <ModalPortal>
          <div className="fixed inset-0 z-[72] flex items-center justify-center bg-slate-900/40 p-3" onClick={() => setScopeModalOpen(false)}>
            <section
              className="panel-glass card w-full max-w-2xl rounded-2xl p-4"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={t("calendar.modal.scopeTitle")}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold tracking-tight">{t("calendar.modal.scopeTitle")}</h3>
                <button
                  aria-label={t("common.close")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white/80 text-muted transition hover:border-accent/45 hover:text-accent"
                  onClick={() => setScopeModalOpen(false)}
                  type="button"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted">{t("calendar.modal.tenantsTitle")}</p>
                  <div className="space-y-2">
                    {tenants.map((tenant) => {
                      const enabled = !disabledTenants.has(tenant);
                      const color = getTenantColor(tenant);
                      return (
                        <label className="flex items-center gap-3 rounded-xl border border-line bg-white/80 px-3 py-2.5 text-sm" key={tenant}>
                          <input
                            checked={enabled}
                            className="h-4 w-4 rounded border-line text-accent focus:ring-accent/40"
                            onChange={() => toggleTenant(tenant)}
                            type="checkbox"
                          />
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="truncate">{tenant}</span>
                        </label>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted">{t("calendar.modal.sourcesTitle")}</p>
                  {calendarSources.length === 0 ? (
                    <p className="muted">{t("calendar.modal.noSources")}</p>
                  ) : (
                    <div className="space-y-2">
                      {calendarSources.map((source) => {
                        const enabled = Boolean(sourceSelection[source.id]);
                        const busy = savingSourceId === source.id;
                        return (
                          <label
                            className={`flex items-center gap-3 rounded-xl border border-line bg-white/80 px-3 py-2.5 text-sm ${busy ? "opacity-70" : ""}`}
                            key={source.id}
                          >
                            <input
                              checked={enabled}
                              className="h-4 w-4 rounded border-line text-accent focus:ring-accent/40"
                              disabled={busy}
                              onChange={() => void toggleSourceSelection(source.id)}
                              type="checkbox"
                            />
                            <span className="min-w-0 flex-1 truncate">
                              <span className="font-medium">{source.tenantName}</span>
                              <span className="mx-1 text-muted">·</span>
                              <span className="text-muted">{source.name}</span>
                            </span>
                            {busy ? <span className="text-xs text-muted">{t("calendar.modal.saving")}</span> : null}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </section>
          </div>
        </ModalPortal>
      ) : null}

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
            const timeLine = formatDateTimeRange(hovered.event.startAt, hovered.event.endAt, intl, hydrated);

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

      <EventDetailModal event={selectedEvent} isLoading={detailLoadingEventId === selectedEvent?.id} onClose={closeEventModal} />
    </>
  );
}
