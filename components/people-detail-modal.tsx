"use client";

import { CalendarPlus, Check, Copy, Mail, MessageSquareText, Star, X } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { useT } from "@/components/locale-provider";

type PersonDetail = {
  id: string;
  displayName: string;
  mail: string;
  jobTitle: string;
  department: string;
  tenantName: string;
  officeLocation: string;
  mobilePhone: string;
  businessPhones: string[];
  sourceAccount: string;
  provider: string;
  upn: string;
  externalPersonId: string;
  managerExternalId: string;
  companyName: string;
  employeeId: string;
  preferredLanguage: string;
  city: string;
  state: string;
  country: string;
  userType: string;
  accountEnabled: boolean | null;
};

type ActionLinks = {
  mailto: string;
  teams: string;
  calendar: string;
  disabled: boolean;
};

type PeopleDetailModalProps = {
  person: PersonDetail | null;
  actionLinks: ActionLinks | null;
  selectedPhone: string;
  copiedField: "mail" | "phone" | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
  onCopyMail: () => void;
  onCopyPhone: () => void;
};

function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (words.length === 0) return "?";
  return words.map((word) => word[0]!.toUpperCase()).join("");
}

function hasUsablePhone(value: string): boolean {
  return Boolean(value && /\d/.test(value));
}

function providerLabel(provider: string, microsoftLabel: string, googleLabel: string): string {
  if (provider === "google") return googleLabel;
  if (provider === "microsoft") return microsoftLabel;
  return provider || "-";
}

function accountStatusLabel(enabled: boolean | null, enabledLabel: string, disabledLabel: string, unknownLabel: string): string {
  if (enabled === true) return enabledLabel;
  if (enabled === false) return disabledLabel;
  return unknownLabel;
}

function DetailField({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <article className={`rounded-xl border border-line bg-white/90 p-3.5 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.13em] text-muted">{label}</p>
      <p className="mt-1.5 break-words text-sm font-medium leading-relaxed text-text">{value || "-"}</p>
    </article>
  );
}

export function PeopleDetailModal({
  person,
  actionLinks,
  selectedPhone,
  copiedField,
  isFavorite,
  onToggleFavorite,
  onClose,
  onCopyMail,
  onCopyPhone
}: PeopleDetailModalProps) {
  const t = useT();

  if (!person || !actionLinks) {
    return null;
  }

  const region = [person.city, person.state, person.country].filter(Boolean).join(", ") || "-";
  const extraBusinessPhones = person.businessPhones.filter((phone) => hasUsablePhone(phone) && phone !== selectedPhone).slice(0, 2).join(" · ");

  const provider = providerLabel(person.provider, t("settings.providerMicrosoft"), t("settings.providerGoogle"));
  const accountStatus = accountStatusLabel(person.accountEnabled, t("people.account.enabled"), t("people.account.disabled"), t("people.account.unknown"));

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4" role="dialog" aria-modal="true">
        <button aria-label={t("common.close")} className="absolute inset-0 cursor-default" onClick={onClose} type="button" />

        <section className="panel-glass card relative z-10 max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl">
          <header className="border-b border-line/70 px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{t("people.detailTitle")}</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-sm font-bold text-accent">
                    {initials(person.displayName)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-xl font-semibold tracking-tight text-text">{person.displayName}</h3>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {person.jobTitle} · {person.department}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-full border border-line bg-white px-2 py-0.5 text-muted">{person.tenantName}</span>
                  <span className="rounded-full border border-line bg-white px-2 py-0.5 text-muted">{provider}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  aria-label={isFavorite ? t("people.favoriteRemove") : t("people.favoriteAdd")}
                  className={`inline-flex h-10 min-w-10 items-center justify-center rounded-xl border px-2.5 text-sm font-medium transition ${isFavorite ? "border-amber-200 bg-amber-50 text-amber-700" : "border-line bg-white text-slate-700 hover:border-amber-300 hover:text-amber-600"}`}
                  onClick={onToggleFavorite}
                  type="button"
                >
                  <Star className={isFavorite ? "fill-current" : ""} size={15} />
                </button>
                <button className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-line bg-white text-slate-700 transition hover:border-accent/45" onClick={onClose} type="button">
                  <X size={15} />
                </button>
              </div>
            </div>
          </header>

          <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
            <section className="rounded-2xl border border-line bg-white/80 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t("people.quickActionsTitle")}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <a
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${actionLinks.disabled ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400" : "border-line bg-white text-slate-700 hover:border-accent/45"}`}
                  href={actionLinks.disabled ? undefined : actionLinks.mailto}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Mail size={16} /> {t("people.action.mail")}
                </a>
                <a
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${actionLinks.disabled ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400" : "border-line bg-white text-slate-700 hover:border-accent/45"}`}
                  href={actionLinks.disabled ? undefined : actionLinks.teams}
                  rel="noreferrer"
                  target="_blank"
                >
                  <MessageSquareText size={16} /> {t("people.action.teams")}
                </a>
                <a
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${actionLinks.disabled ? "pointer-events-none border-slate-200 bg-slate-100 text-slate-400" : "border-line bg-white text-slate-700 hover:border-accent/45"}`}
                  href={actionLinks.disabled ? undefined : actionLinks.calendar}
                  rel="noreferrer"
                  target="_blank"
                >
                  <CalendarPlus size={16} /> {t("people.action.meeting")}
                </a>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white/80 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t("people.copyActionsTitle")}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${person.mail ? "border-line bg-white text-slate-700 hover:border-accent/45" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"}`}
                  disabled={!person.mail}
                  onClick={onCopyMail}
                  type="button"
                >
                  {copiedField === "mail" ? <Check size={16} /> : <Copy size={16} />}
                  {copiedField === "mail" ? t("people.copyMailDone") : t("people.copyMail")}
                </button>
                <button
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${hasUsablePhone(selectedPhone) ? "border-line bg-white text-slate-700 hover:border-accent/45" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"}`}
                  disabled={!hasUsablePhone(selectedPhone)}
                  onClick={onCopyPhone}
                  type="button"
                >
                  {copiedField === "phone" ? <Check size={16} /> : <Copy size={16} />}
                  {copiedField === "phone" ? t("people.copyPhoneDone") : t("people.copyPhone")}
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white/80 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t("people.sectionContact")}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <DetailField label={t("people.field.mail")} value={person.mail} />
                <DetailField label={t("people.field.phone")} value={selectedPhone || "-"} />
                <DetailField label={t("people.field.businessPhones")} value={extraBusinessPhones || "-"} />
                <DetailField label={t("people.field.office")} value={person.officeLocation} />
                <DetailField label={t("people.field.tenant")} value={person.tenantName} />
                <DetailField label={t("people.field.region")} value={region} />
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white/80 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t("people.sectionWork")}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <DetailField label={t("people.field.company")} value={person.companyName} />
                <DetailField label={t("people.field.employeeId")} value={person.employeeId} />
                <DetailField label={t("people.field.preferredLanguage")} value={person.preferredLanguage} />
                <DetailField label={t("people.field.userType")} value={person.userType} />
                <DetailField label={t("people.field.accountStatus")} value={accountStatus} />
                <DetailField label={t("people.field.provider")} value={provider} />
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white/80 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{t("people.sectionDirectory")}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <DetailField label={t("people.field.upn")} value={person.upn} wide />
                <DetailField label={t("people.field.sourceAccount")} value={person.sourceAccount} wide />
                <DetailField label={t("people.field.objectId")} value={person.externalPersonId} wide />
                <DetailField label={t("people.field.managerObjectId")} value={person.managerExternalId} wide />
              </div>
            </section>
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}
