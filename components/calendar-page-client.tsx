"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { ModalPortal } from "@/components/modal-portal";
import { UnifiedWeekCalendar } from "@/components/unified-week-calendar";
import { useAppPreferences } from "@/components/app-preferences-provider";
import { useT } from "@/components/locale-provider";
import { trackClientEvent } from "@/lib/analytics/client";
import { analyticsEvents } from "@/lib/analytics/events";
import type { CalendarEventRow, CalendarSourceRow } from "@/components/calendar-events-overview";

type EventVisibilityFilters = {
  includeTentative: boolean;
  includeWorkingElsewhere: boolean;
  includeAwaitingResponse: boolean;
  includeDeclined: boolean;
  includeCancelled: boolean;
};

type CalendarPageClientProps = {
  calendarSources: CalendarSourceRow[];
  events: CalendarEventRow[];
  tenants: string[];
};

const EVENT_VISIBILITY_FILTERS_STORAGE_KEY = "converge_calendar_visibility_filters";

const DEFAULT_EVENT_VISIBILITY_FILTERS: EventVisibilityFilters = {
  includeTentative: false,
  includeWorkingElsewhere: false,
  includeAwaitingResponse: false,
  includeDeclined: false,
  includeCancelled: false
};

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

export function CalendarPageClient({ calendarSources, events, tenants }: CalendarPageClientProps) {
  const t = useT();
  const router = useRouter();
  const { getTenantColor } = useAppPreferences();

  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [disabledTenants, setDisabledTenants] = useState<Set<string>>(() => new Set());
  const [visibilityModalOpen, setVisibilityModalOpen] = useState(false);
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [savingSourceId, setSavingSourceId] = useState<string | null>(null);
  const [visibilityFilters, setVisibilityFilters] = useState<EventVisibilityFilters>(DEFAULT_EVENT_VISIBILITY_FILTERS);
  const [sourceSelection, setSourceSelection] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(calendarSources.map((source) => [source.id, source.isSelected]))
  );
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    setVisibilityFilters(parseEventVisibilityFilters(window.localStorage.getItem(EVENT_VISIBILITY_FILTERS_STORAGE_KEY)));
  }, []);

  useEffect(() => {
    setSourceSelection(Object.fromEntries(calendarSources.map((source) => [source.id, source.isSelected])));
  }, [calendarSources]);

  const selectedSourceIds = useMemo(
    () => new Set(Object.entries(sourceSelection).filter(([, selected]) => selected).map(([sourceId]) => sourceId)),
    [sourceSelection]
  );

  const activeVisibilityFilterCount = useMemo(() => Object.values(visibilityFilters).filter(Boolean).length, [visibilityFilters]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (!passesVisibilityFilters(event, visibilityFilters)) {
        return false;
      }
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
  }, [calendarSources.length, deferredQuery, disabledTenants, events, selectedSourceIds, visibilityFilters]);

  function toggleVisibilityFilter(key: keyof EventVisibilityFilters) {
    let nextEnabled = false;
    setVisibilityFilters((prev) => {
      nextEnabled = !prev[key];
      const next = { ...prev, [key]: nextEnabled };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(EVENT_VISIBILITY_FILTERS_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });

    void trackClientEvent(analyticsEvents.calendarFilterChanged, {
      filterKey: key,
      enabled: nextEnabled,
      surface: "visibility_modal"
    });
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
          {t("calendar.controls.scope")} {calendarSources.length > 0 ? `(${selectedSourceIds.size}/${calendarSources.length})` : ""}
        </button>
      </div>

      <UnifiedWeekCalendar events={filteredEvents} tenants={tenants.filter((tenant) => !disabledTenants.has(tenant))} />

      {visibilityModalOpen ? (
        <ModalPortal>
          <div className="fixed inset-0 z-[72] flex items-center justify-center bg-slate-900/40 p-3" onClick={() => setVisibilityModalOpen(false)}>
            <section
              aria-label={t("calendar.modal.visibilityTitle")}
              aria-modal="true"
              className="panel-glass card w-full max-w-md rounded-2xl p-4"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
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
              aria-label={t("calendar.modal.scopeTitle")}
              aria-modal="true"
              className="panel-glass card w-full max-w-2xl rounded-2xl p-4"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
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
    </>
  );
}
