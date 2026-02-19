"use client";

import type { ReactNode } from "react";
import { ModalPortal } from "@/components/modal-portal";
import { useIntlLocale, useT } from "@/components/locale-provider";

export type EventDetailItem = {
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

type EventDetailModalProps = {
  event: EventDetailItem | null;
  onClose: () => void;
};

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

function formatDateTimeRange(startIso: string, endIso: string, intl: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameDay = start.toDateString() === end.toDateString();

  if (sameDay) {
    return `${start.toLocaleDateString(intl, { year: "numeric", month: "short", day: "numeric", weekday: "short" })} ${start.toLocaleTimeString(intl, {
      hour: "2-digit",
      minute: "2-digit"
    })} - ${end.toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })}`;
  }

  return `${start.toLocaleString(intl, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })} - ${end.toLocaleString(intl, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function toReadableValue(raw: string): string {
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .trim();
}

function DetailField({ label, value, extra }: { label: string; value: ReactNode; extra?: ReactNode }) {
  return (
    <article className="rounded-xl border border-line bg-white/85 p-3.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-muted">{label}</p>
      <div className="mt-1.5 text-sm font-medium leading-relaxed text-text">{value}</div>
      {extra}
    </article>
  );
}

export function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  const t = useT();
  const intl = useIntlLocale();

  if (!event) {
    return null;
  }

  const providerLabel = event.provider === "google" ? t("settings.providerGoogle") : event.provider === "microsoft" ? t("settings.providerMicrosoft") : event.provider ?? "-";

  const mapImportance = (raw?: string | null): string => {
    if (!raw) return "-";
    const normalized = raw.toLowerCase();
    if (normalized === "low") return t("event.value.importance.low");
    if (normalized === "normal") return t("event.value.importance.normal");
    if (normalized === "high") return t("event.value.importance.high");
    return toReadableValue(raw);
  };

  const mapSensitivity = (raw?: string | null): string => {
    if (!raw) return "-";
    const normalized = raw.toLowerCase();
    if (normalized === "normal") return t("event.value.sensitivity.normal");
    if (normalized === "personal") return t("event.value.sensitivity.personal");
    if (normalized === "private") return t("event.value.sensitivity.private");
    if (normalized === "confidential") return t("event.value.sensitivity.confidential");
    return toReadableValue(raw);
  };

  const mapShowAs = (raw?: string | null): string => {
    if (!raw) return "-";
    const normalized = raw.toLowerCase();
    if (normalized === "free") return t("event.value.showAs.free");
    if (normalized === "tentative") return t("event.value.showAs.tentative");
    if (normalized === "busy") return t("event.value.showAs.busy");
    if (normalized === "oof") return t("event.value.showAs.oof");
    if (normalized === "workingelsewhere") return t("event.value.showAs.workingElsewhere");
    if (normalized === "unknown") return t("event.value.showAs.unknown");
    return toReadableValue(raw);
  };

  const mapResponse = (raw?: string | null): string => {
    if (!raw) return "-";
    const normalized = raw.toLowerCase();
    if (normalized === "accepted") return t("event.value.response.accepted");
    if (normalized === "declined") return t("event.value.response.declined");
    if (normalized === "tentative") return t("event.value.response.tentative");
    if (normalized === "tentativelyaccepted") return t("event.value.response.tentative");
    if (normalized === "notresponded") return t("event.value.response.notResponded");
    if (normalized === "organizer") return t("event.value.response.organizer");
    if (normalized === "none") return t("event.value.response.none");
    return toReadableValue(raw);
  };

  const mapEventType = (raw?: string | null): string => {
    if (!raw) return "-";
    const normalized = raw.toLowerCase();
    if (normalized === "singleinstance") return t("event.value.eventType.singleInstance");
    if (normalized === "occurrence") return t("event.value.eventType.occurrence");
    if (normalized === "exception") return t("event.value.eventType.exception");
    if (normalized === "seriesmaster") return t("event.value.eventType.seriesMaster");
    return toReadableValue(raw);
  };

  const mapAttendeeType = (raw?: string | null): string | null => {
    if (!raw) return null;
    const normalized = raw.toLowerCase();
    if (normalized === "required") return t("event.value.attendeeType.required");
    if (normalized === "optional") return t("event.value.attendeeType.optional");
    if (normalized === "resource") return t("event.value.attendeeType.resource");
    return toReadableValue(raw);
  };

  const categories = event.categories ?? [];

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4" role="dialog" aria-modal="true">
        <button aria-label={t("common.close")} className="absolute inset-0 cursor-default" onClick={onClose} type="button" />

        <section className="panel-glass card relative z-10 max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl p-4 sm:p-5">
          <header className="flex items-start justify-between gap-3 border-b border-line/70 pb-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{t("event.detailTitle")}</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-text">{event.subject}</h3>
              <p className="mt-1 text-sm text-muted">{formatDateTimeRange(event.startAt, event.endAt, intl)}</p>
              {event.isCancelled ? (
                <span className="mt-2 inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                  {t("event.cancelled")}
                </span>
              ) : null}
            </div>
            <button className="btn btn-secondary px-3 py-1.5" onClick={onClose} type="button">
              {t("common.close")}
            </button>
          </header>

          <div className="mt-4 space-y-4">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailField label={t("event.sourceTenant")} value={event.tenantName} />
              <DetailField label={t("event.sourceAccount")} value={event.sourceAccount} />
              <DetailField label={t("event.provider")} value={providerLabel} />
              <DetailField label={t("event.calendar")} value={event.calendarName ?? t("event.defaultCalendar")} />
            </section>

            <section className="rounded-2xl border border-line bg-white/85 p-4">
              <h4 className="text-sm font-semibold tracking-tight text-text">{t("event.sectionOverview")}</h4>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <DetailField label={t("event.time")} value={formatDateTimeRange(event.startAt, event.endAt, intl)} />
                <DetailField
                  label={t("event.duration")}
                  value={formatDuration(event.startAt, event.endAt)}
                  extra={
                    <p className="mt-1.5 text-xs text-muted">
                      {t("event.allDay")}: {event.isAllDay ? t("common.yes") : t("common.no")}
                    </p>
                  }
                />
                <DetailField label={t("event.location")} value={event.location} />
                <DetailField label={t("event.organizer")} value={event.organizerName ?? event.organizer ?? event.sourceAccount} />
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white/85 p-4">
              <h4 className="text-sm font-semibold tracking-tight text-text">{t("event.sectionMeeting")}</h4>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <DetailField label={t("event.importance")} value={mapImportance(event.importance)} />
                <DetailField label={t("event.sensitivity")} value={mapSensitivity(event.sensitivity)} />
                <DetailField label={t("event.showAs")} value={mapShowAs(event.showAs)} />
                <DetailField label={t("event.eventType")} value={mapEventType(event.eventType)} />
                <DetailField label={t("event.responseStatus")} value={mapResponse(event.responseStatus)} />
                <DetailField
                  label={t("event.responseTime")}
                  value={event.responseTime ? new Date(event.responseTime).toLocaleString(intl) : "-"}
                />
                <DetailField
                  label={t("event.onlineMeeting")}
                  value={event.isOnlineMeeting ? t("common.yes") : t("common.no")}
                  extra={
                    event.onlineMeetingUrl ? (
                      <a className="mt-1.5 inline-flex text-xs font-medium text-accent hover:underline" href={event.onlineMeetingUrl} rel="noreferrer" target="_blank">
                        {t("event.joinLink")}
                      </a>
                    ) : null
                  }
                />
                <DetailField
                  label={t("event.categories")}
                  value={categories.length > 0 ? categories.join(", ") : "-"}
                />
              </div>
            </section>

            {event.attendeeDetails && event.attendeeDetails.length > 0 ? (
              <section className="rounded-2xl border border-line bg-white/85 p-4">
                <h4 className="text-sm font-semibold tracking-tight text-text">{t("event.sectionAttendees")}</h4>
                <ul className="mt-3 space-y-2">
                  {event.attendeeDetails.map((attendee, index) => {
                    const attendeeType = mapAttendeeType(attendee.type);
                    const attendeeResponse = mapResponse(attendee.response);

                    return (
                      <li className="rounded-xl border border-line bg-white p-3" key={`${attendee.email}-${index}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-text">{attendee.name || attendee.email}</p>
                            {attendee.name ? <p className="truncate text-xs text-muted">{attendee.email}</p> : null}
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs">
                            {attendeeType ? <span className="rounded-full border border-line bg-white px-2 py-0.5 text-muted">{attendeeType}</span> : null}
                            {attendee.response ? <span className="rounded-full border border-line bg-white px-2 py-0.5 text-muted">{attendeeResponse}</span> : null}
                          </div>
                        </div>

                        {attendee.respondedAt ? <p className="mt-1.5 text-xs text-muted">{new Date(attendee.respondedAt).toLocaleString(intl)}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : event.attendees.length > 0 ? (
              <section className="rounded-2xl border border-line bg-white/85 p-4">
                <h4 className="text-sm font-semibold tracking-tight text-text">{t("event.sectionAttendees")}</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {event.attendees.map((attendee) => (
                    <span className="inline-flex rounded-full border border-line bg-white px-2.5 py-1 text-xs text-muted" key={attendee}>
                      {attendee}
                    </span>
                  ))}
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-line bg-white/85 p-4">
                <h4 className="text-sm font-semibold tracking-tight text-text">{t("event.sectionAttendees")}</h4>
                <p className="mt-2 text-sm text-muted">{t("event.attendeesEmpty")}</p>
              </section>
            )}

            {event.bodyPreview ? (
              <section className="rounded-2xl border border-line bg-white/85 p-4">
                <h4 className="text-sm font-semibold tracking-tight text-text">{t("event.sectionNotes")}</h4>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{event.bodyPreview}</p>
              </section>
            ) : null}

            <section className="rounded-2xl border border-line bg-white/85 p-4">
              <h4 className="text-sm font-semibold tracking-tight text-text">{t("event.sectionMeta")}</h4>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <DetailField label={t("event.created")} value={event.createdAt ? new Date(event.createdAt).toLocaleString(intl) : "-"} />
                <DetailField label={t("event.lastUpdated")} value={event.lastModifiedAt ? new Date(event.lastModifiedAt).toLocaleString(intl) : "-"} />
                <DetailField label={t("event.startTimezone")} value={event.timezoneStart ?? "-"} />
                <DetailField label={t("event.endTimezone")} value={event.timezoneEnd ?? "-"} />
                <DetailField
                  label={t("event.webLink")}
                  value={
                    event.webLink ? (
                      <a className="inline-flex font-medium text-accent hover:underline" href={event.webLink} rel="noreferrer" target="_blank">
                        {t("event.openOriginal")}
                      </a>
                    ) : (
                      "-"
                    )
                  }
                />
              </div>
            </section>
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}
