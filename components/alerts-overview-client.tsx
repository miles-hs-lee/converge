"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useAppPreferences } from "@/components/app-preferences-provider";
import { useIntlLocale, useT } from "@/components/locale-provider";
import type { CalendarConflict } from "@/lib/calendar-conflicts";
import type { EventDetailItem } from "@/components/event-detail-modal";
import { trackClientEvent } from "@/lib/analytics/client";
import { analyticsEvents } from "@/lib/analytics/events";

type AlertEventRow = EventDetailItem & { detailLoaded?: boolean };

type AlertsOverviewClientProps = {
  events: AlertEventRow[];
  initialConflicts: CalendarConflict[];
  tenants: string[];
};

const EventDetailModal = dynamic(() => import("@/components/event-detail-modal").then((mod) => mod.EventDetailModal), {
  loading: () => null,
  ssr: false
});

function formatRange(startIso: string, endIso: string, intl: string): string {
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

export function AlertsOverviewClient({ events, initialConflicts, tenants }: AlertsOverviewClientProps) {
  const t = useT();
  const intl = useIntlLocale();
  const { getTenantColor } = useAppPreferences();
  const [localEvents, setLocalEvents] = useState<AlertEventRow[]>(events);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<AlertEventRow | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const lastViewedKeyRef = useRef<string>("");
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    setLocalEvents(events);
  }, [events]);

  const eventsById = useMemo(() => new Map(localEvents.map((event) => [event.id, event])), [localEvents]);

  const conflicts = useMemo(() => {
    return initialConflicts
      .filter((conflict) => !dismissed.has(conflict.key))
      .filter((conflict) => {
        if (!normalizedQuery) return true;
        const haystack = `${conflict.a.subject} ${conflict.b.subject} ${conflict.a.tenantName} ${conflict.b.tenantName}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      });
  }, [dismissed, initialConflicts, normalizedQuery]);

  const visibleConflicts = showAll ? conflicts : conflicts.slice(0, 10);

  useEffect(() => {
    const key = `${conflicts.length}|${normalizedQuery.length}|${tenants.length}`;
    if (lastViewedKeyRef.current === key) {
      return;
    }
    lastViewedKeyRef.current = key;
    void trackClientEvent(analyticsEvents.conflictsViewed, {
      conflictCount: conflicts.length,
      queryLength: normalizedQuery.length,
      tenantCount: tenants.length
    });
  }, [conflicts.length, normalizedQuery.length, tenants.length]);

  function resolveEvent(id: string): AlertEventRow | null {
    return (
      eventsById.get(id) ?? {
        id,
        tenantName: "Connected Account",
        subject: t("common.untitled"),
        startAt: new Date().toISOString(),
        endAt: new Date().toISOString(),
        location: t("common.locationUnknown"),
        sourceAccount: t("common.unknownAccount"),
        attendees: [],
        attendeeDetails: [],
        detailLoaded: false
      }
    );
  }

  function closeModal() {
    setSelectedEvent(null);
  }

  function openEventDetail(id: string) {
    const base = resolveEvent(id);
    if (!base) return;
    void trackClientEvent(analyticsEvents.conflictsItemOpened, {
      source: "list",
      eventId: base.id,
      tenantName: base.tenantName,
      provider: base.provider ?? "unknown"
    });
    void trackClientEvent(analyticsEvents.calendarEventOpened, {
      source: "conflict_alerts",
      eventId: base.id,
      tenantName: base.tenantName,
      provider: base.provider ?? "unknown",
      isAllDay: Boolean(base.isAllDay)
    });
    setSelectedEvent(base);
    if (base.detailLoaded || detailLoadingId === id) {
      return;
    }

    const run = async () => {
      setDetailLoadingId(id);
      try {
        const response = await fetch(`/api/calendar/event?id=${encodeURIComponent(id)}`);
        if (!response.ok) return;
        const json = (await response.json()) as { ok: boolean; item?: AlertEventRow };
        if (!json.ok || !json.item) return;

        const detail = { ...json.item, detailLoaded: true };
        setLocalEvents((prev) => (prev.some((row) => row.id === id) ? prev.map((row) => (row.id === id ? { ...row, ...detail } : row)) : [...prev, detail]));
        setSelectedEvent((prev) => (prev?.id === id ? { ...prev, ...detail } : prev));
      } catch {
        // ignore detail load failures
      } finally {
        setDetailLoadingId((current) => (current === id ? null : current));
      }
    };

    void run();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <span className="badge">{t("alerts.count", { count: conflicts.length })}</span>
      </div>

      {conflicts.length === 0 ? (
        <p className="muted">{t("alerts.none")}</p>
      ) : (
        <div className="space-y-2">
          {visibleConflicts.map((conflict) => {
            const aColor = getTenantColor(conflict.a.tenantName);
            const bColor = getTenantColor(conflict.b.tenantName);
            return (
              <article className="rounded-xl border border-line bg-white p-3" key={conflict.key}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium text-muted">{formatRange(conflict.overlapStart, conflict.overlapEnd, intl)}</p>
                    <button
                      className="mt-1 block text-left text-sm font-semibold text-text hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                      onClick={() => openEventDetail(conflict.a.id)}
                      type="button"
                    >
                      {conflict.a.subject}
                    </button>
                    <button
                      className="mt-1 block text-left text-sm font-semibold text-text hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                      onClick={() => openEventDetail(conflict.b.id)}
                      type="button"
                    >
                      {conflict.b.subject}
                    </button>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1" style={{ color: aColor }}>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: aColor }} />
                        {conflict.a.tenantName}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1" style={{ color: bColor }}>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: bColor }} />
                        {conflict.b.tenantName}
                      </span>
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary px-3 py-1.5"
                    onClick={() =>
                      setDismissed((prev) => {
                        const next = new Set(prev);
                        next.add(conflict.key);
                        return next;
                      })
                    }
                    type="button"
                  >
                    {t("alerts.dismiss")}
                  </button>
                </div>
              </article>
            );
          })}

          {conflicts.length > 10 ? (
            <button
              className="inline-flex rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-accent/45 hover:text-accent"
              onClick={() => setShowAll((prev) => !prev)}
              type="button"
            >
              {showAll ? t("common.close") : t("common.more", { count: conflicts.length - 10 })}
            </button>
          ) : null}
        </div>
      )}

      <EventDetailModal event={selectedEvent} isLoading={detailLoadingId === selectedEvent?.id} onClose={closeModal} />
    </div>
  );
}
