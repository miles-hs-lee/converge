"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { UnifiedWeekCalendar } from "@/components/unified-week-calendar";
import { colorForTenant } from "@/lib/tenant-colors";
import { useT, useIntlLocale } from "@/components/locale-provider";

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

function EventList({
  title,
  events,
  emptyText,
  attendeesLabel,
  intl
}: {
  title: string;
  events: CalendarEventRow[];
  emptyText: string;
  attendeesLabel: (count: number) => string;
  intl: string;
}) {
  return (
    <section className="rounded-2xl border border-line bg-white/85 p-4">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      {events.length === 0 ? (
        <p className="muted mt-2">{emptyText}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {events.map((event) => (
            <article className="rounded-xl border border-line bg-white p-3 transition hover:border-accent/45" key={event.id}>
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
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function CalendarEventsOverview({ events, tenants }: CalendarEventsOverviewProps) {
  const t = useT();
  const intl = useIntlLocale();
  const [query, setQuery] = useState("");
  const [rangeDays, setRangeDays] = useState<3 | 7>(3);
  const [disabledTenants, setDisabledTenants] = useState<Set<string>>(() => new Set());

  const enabledTenants = useMemo(() => tenants.filter((tenant) => !disabledTenants.has(tenant)), [disabledTenants, tenants]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((event) => {
      if (disabledTenants.has(event.tenantName)) {
        return false;
      }

      if (!q) {
        return true;
      }

      return (
        event.subject.toLowerCase().includes(q) ||
        event.location.toLowerCase().includes(q) ||
        event.tenantName.toLowerCase().includes(q) ||
        event.sourceAccount.toLowerCase().includes(q) ||
        event.attendees.some((attendee) => attendee.toLowerCase().includes(q))
      );
    });
  }, [disabledTenants, events, query]);

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
        {tenants.map((tenant) => {
          const enabled = !disabledTenants.has(tenant);
          const color = colorForTenant(tenant);
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
            title={t("calendar.past")}
          />
          <EventList
            attendeesLabel={(count) => t("calendar.attendeesCount", { count })}
            emptyText={t("calendar.none")}
            events={upcomingEvents}
            intl={intl}
            title={t("calendar.upcoming")}
          />
        </div>
      </section>
    </>
  );
}
