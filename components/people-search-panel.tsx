"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Mail,
  MessageSquareText,
  Search,
  Star,
  X
} from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { useIntlLocale, useT } from "@/components/locale-provider";

type PersonRow = {
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

type PeopleSearchPanelProps = {
  people: PersonRow[];
};

const FAVORITES_STORAGE_KEY = "converge:favorites:people";
const RECENTS_STORAGE_KEY = "converge:recent:people";

function buildActionLinks(person: PersonRow) {
  const email = person.mail;
  const mailto = email ? `mailto:${email}` : "#";
  const teams = email ? `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(email)}` : "#";

  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 30);

  const calendar = email
    ? `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(`${person.displayName} meeting`)}&to=${encodeURIComponent(email)}&startdt=${encodeURIComponent(start.toISOString())}&enddt=${encodeURIComponent(end.toISOString())}`
    : "#";

  return { mailto, teams, calendar, disabled: !email };
}

function readStoredIds(key: string): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function writeStoredIds(key: string, ids: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(ids));
}

function hasUsablePhone(value: string): boolean {
  return Boolean(value && /\d/.test(value));
}

function digitsOnly(value: string): string {
  return (value ?? "").replace(/[^\d]/g, "");
}

function getPrimaryPhone(person: PersonRow): string {
  if (hasUsablePhone(person.mobilePhone)) {
    return person.mobilePhone;
  }
  const candidate = (person.businessPhones ?? []).find((phone) => hasUsablePhone(phone));
  return candidate ?? person.mobilePhone;
}

export function PeopleSearchPanel({ people }: PeopleSearchPanelProps) {
  const t = useT();
  const intl = useIntlLocale();

  const [query, setQuery] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"default" | "tenant">("default");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [collapsedTenants, setCollapsedTenants] = useState<Record<string, boolean>>({});
  const [copiedField, setCopiedField] = useState<"mail" | "phone" | null>(null);

  useEffect(() => {
    setFavoriteIds(readStoredIds(FAVORITES_STORAGE_KEY));
    setRecentIds(readStoredIds(RECENTS_STORAGE_KEY));
  }, []);

  useEffect(() => {
    writeStoredIds(FAVORITES_STORAGE_KEY, favoriteIds);
  }, [favoriteIds]);

  useEffect(() => {
    writeStoredIds(RECENTS_STORAGE_KEY, recentIds);
  }, [recentIds]);

  const peopleById = useMemo(() => {
    return new Map(people.map((person) => [person.id, person]));
  }, [people]);

  const favoritePeople = useMemo(() => {
    return favoriteIds.map((id) => peopleById.get(id)).filter((item): item is PersonRow => Boolean(item));
  }, [favoriteIds, peopleById]);

  const recentPeople = useMemo(() => {
    return recentIds.map((id) => peopleById.get(id)).filter((item): item is PersonRow => Boolean(item));
  }, [recentIds, peopleById]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return people;
    }

    const qDigits = digitsOnly(q);
    const wantsPhone = qDigits.length > 0;

    return people.filter((person) => {
      if (wantsPhone) {
        const mobileDigits = digitsOnly(person.mobilePhone);
        const businessDigits = (person.businessPhones ?? []).map((phone) => digitsOnly(phone));
        if (mobileDigits.includes(qDigits) || businessDigits.some((digits) => digits.includes(qDigits))) {
          return true;
        }
      }

      return (
        person.displayName.toLowerCase().includes(q) ||
        person.mail.toLowerCase().includes(q) ||
        person.upn.toLowerCase().includes(q) ||
        person.department.toLowerCase().includes(q) ||
        person.tenantName.toLowerCase().includes(q) ||
        person.sourceAccount.toLowerCase().includes(q) ||
        person.companyName.toLowerCase().includes(q) ||
        person.employeeId.toLowerCase().includes(q)
      );
    });
  }, [people, query]);

  const sortedByTenant = useMemo(() => {
    return [...filtered].sort((a, b) => {
      return a.tenantName.localeCompare(b.tenantName, intl) || a.displayName.localeCompare(b.displayName, intl);
    });
  }, [filtered, intl]);

  const tenantGroups = useMemo(() => {
    const groups = new Map<string, PersonRow[]>();
    sortedByTenant.forEach((person) => {
      const current = groups.get(person.tenantName);
      if (current) {
        current.push(person);
      } else {
        groups.set(person.tenantName, [person]);
      }
    });
    return Array.from(groups.entries()).map(([tenantName, items]) => ({ tenantName, items }));
  }, [sortedByTenant]);

  const selectedPerson = useMemo(() => {
    if (!selectedPersonId) {
      return null;
    }
    return people.find((person) => person.id === selectedPersonId) ?? null;
  }, [people, selectedPersonId]);

  const actionLinks = selectedPerson ? buildActionLinks(selectedPerson) : null;
  const selectedPhone = selectedPerson ? getPrimaryPhone(selectedPerson) : "";
  const providerLabel = (provider: string) =>
    provider === "google" ? t("settings.providerGoogle") : provider === "microsoft" ? t("settings.providerMicrosoft") : provider;
  const accountStatusLabel = (enabled: boolean | null) => {
    if (enabled === true) return t("people.account.enabled");
    if (enabled === false) return t("people.account.disabled");
    return t("people.account.unknown");
  };
  const showPinnedSections = query.trim().length === 0;

  function openPerson(personId: string) {
    setSelectedPersonId(personId);
    setRecentIds((prev) => [personId, ...prev.filter((id) => id !== personId)].slice(0, 8));
  }

  function toggleFavorite(personId: string) {
    setFavoriteIds((prev) => {
      if (prev.includes(personId)) {
        return prev.filter((id) => id !== personId);
      }
      return [personId, ...prev].slice(0, 16);
    });
  }

  function toggleTenant(tenantName: string) {
    setCollapsedTenants((prev) => ({ ...prev, [tenantName]: !prev[tenantName] }));
  }

  async function copyToClipboard(value: string, field: "mail" | "phone") {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => {
        setCopiedField((current) => (current === field ? null : current));
      }, 1400);
    } catch {
      setCopiedField(null);
    }
  }

  function renderPersonCard(person: PersonRow, options?: { hideTenant?: boolean }) {
    const isFavorite = favoriteIds.includes(person.id);
    return (
      <article className="flex items-start gap-2 rounded-xl border border-line bg-white/90 p-2.5" key={person.id}>
        <button
          className="flex-1 rounded-lg px-1 py-1 text-left transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
          onClick={() => openPerson(person.id)}
          type="button"
        >
          <p className="text-sm font-semibold">{person.displayName}</p>
          <p className="mt-1 text-xs text-muted">
            {person.jobTitle} · {person.department}
            {!options?.hideTenant ? ` · ${person.tenantName}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">{person.mail}</p>
        </button>
        <button
          aria-label={isFavorite ? t("people.favoriteRemove") : t("people.favoriteAdd")}
          className={`mt-1 rounded-lg p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 ${isFavorite ? "text-amber-500 hover:bg-amber-50" : "text-slate-400 hover:bg-slate-100 hover:text-amber-500"}`}
          onClick={() => toggleFavorite(person.id)}
          type="button"
        >
          <Star className={isFavorite ? "fill-current" : ""} size={16} />
        </button>
      </article>
    );
  }

  return (
    <>
      <label className="relative mt-1 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
        <input
          className="input-control pl-9"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("people.searchPlaceholder")}
          type="search"
          value={query}
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">{t("common.total", { count: filtered.length })}</p>
        <div className="inline-flex rounded-xl border border-line bg-white p-0.5 text-sm">
          <button
            className={`rounded-lg px-3 py-1.5 font-medium ${sortMode === "default" ? "bg-accent text-white" : "text-slate-700"}`}
            onClick={() => setSortMode("default")}
            type="button"
          >
            {t("people.sort.default")}
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 font-medium ${sortMode === "tenant" ? "bg-accent text-white" : "text-slate-700"}`}
            onClick={() => setSortMode("tenant")}
            type="button"
          >
            {t("people.sort.tenant")}
          </button>
        </div>
      </div>

      {showPinnedSections ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <section className="rounded-xl border border-line bg-white/80 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Star className="text-amber-500" size={14} />
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{t("people.favoritesTitle")}</p>
            </div>
            {favoritePeople.length === 0 ? (
              <p className="text-xs text-muted">{t("people.favoritesHint")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {favoritePeople.map((person) => (
                  <button
                    className="surface-chip hover:border-accent/45"
                    key={person.id}
                    onClick={() => openPerson(person.id)}
                    type="button"
                  >
                    <span className="font-semibold">{person.displayName}</span>
                    <span className="text-muted">{person.tenantName}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-line bg-white/80 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Clock3 className="text-accent" size={14} />
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{t("people.recentsTitle")}</p>
            </div>
            {recentPeople.length === 0 ? (
              <p className="text-xs text-muted">{t("people.recentsHint")}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recentPeople.map((person) => (
                  <button
                    className="surface-chip hover:border-accent/45"
                    key={person.id}
                    onClick={() => openPerson(person.id)}
                    type="button"
                  >
                    <span className="font-semibold">{person.displayName}</span>
                    <span className="text-muted">{person.tenantName}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      <div className="mt-3 space-y-2 text-sm">
        {sortMode === "default"
          ? filtered.map((person) => renderPersonCard(person))
          : tenantGroups.map((group) => {
              const collapsed = Boolean(collapsedTenants[group.tenantName]);
              return (
                <section className="rounded-xl border border-line bg-white/75 p-2" key={group.tenantName}>
                  <button
                    className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left"
                    onClick={() => toggleTenant(group.tenantName)}
                    type="button"
                  >
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{group.tenantName}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                      {t("people.searchCount", { count: group.items.length })}
                      {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </button>
                  {!collapsed ? <div className="mt-2 space-y-2">{group.items.map((person) => renderPersonCard(person, { hideTenant: true }))}</div> : null}
                </section>
              );
            })}

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-white/70 px-3 py-6 text-center text-muted">
            {t("people.noResults")}
          </div>
        ) : null}
      </div>

      {selectedPerson && actionLinks ? (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4" role="dialog" aria-modal="true">
            <button
              aria-label={t("common.close")}
              className="absolute inset-0 cursor-default"
              onClick={() => setSelectedPersonId(null)}
              type="button"
            />

            <section className="panel-glass card relative z-10 max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-4 pb-7 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-accent">{t("people.title")}</p>
                  <h3 className="mt-1 text-xl font-semibold">{selectedPerson.displayName}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {selectedPerson.jobTitle} · {selectedPerson.department} · {selectedPerson.tenantName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className={`btn btn-secondary px-3 py-1.5 ${favoriteIds.includes(selectedPerson.id) ? "border-amber-200 bg-amber-50 text-amber-700" : ""}`}
                    onClick={() => toggleFavorite(selectedPerson.id)}
                    type="button"
                  >
                    <Star className={favoriteIds.includes(selectedPerson.id) ? "fill-current" : ""} size={14} />
                    {t("people.action.favorite")}
                  </button>
                  <button
                    className="btn btn-secondary px-3 py-1.5"
                    onClick={() => setSelectedPersonId(null)}
                    type="button"
                  >
                    <X size={14} /> {t("common.close")}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-3">
                <a
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${actionLinks.disabled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-line bg-white hover:border-accent/45"}`}
                  href={actionLinks.disabled ? undefined : actionLinks.mailto}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Mail size={16} /> {t("people.action.mail")}
                </a>
                <a
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${actionLinks.disabled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-line bg-white hover:border-accent/45"}`}
                  href={actionLinks.disabled ? undefined : actionLinks.teams}
                  rel="noreferrer"
                  target="_blank"
                >
                  <MessageSquareText size={16} /> {t("people.action.teams")}
                </a>
                <a
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${actionLinks.disabled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-line bg-white hover:border-accent/45"}`}
                  href={actionLinks.disabled ? undefined : actionLinks.calendar}
                  rel="noreferrer"
                  target="_blank"
                >
                  <CalendarPlus size={16} /> {t("people.action.meeting")}
                </a>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <button
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${selectedPerson.mail ? "border-line bg-white hover:border-accent/45" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"}`}
                  disabled={!selectedPerson.mail}
                  onClick={() => copyToClipboard(selectedPerson.mail, "mail")}
                  type="button"
                >
                  {copiedField === "mail" ? <Check size={16} /> : <Copy size={16} />}
                  {copiedField === "mail" ? t("people.copyMailDone") : t("people.copyMail")}
                </button>
                <button
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${hasUsablePhone(selectedPhone) ? "border-line bg-white hover:border-accent/45" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"}`}
                  disabled={!hasUsablePhone(selectedPhone)}
                  onClick={() => copyToClipboard(selectedPhone, "phone")}
                  type="button"
                >
                  {copiedField === "phone" ? <Check size={16} /> : <Copy size={16} />}
                  {copiedField === "phone" ? t("people.copyPhoneDone") : t("people.copyPhone")}
                </button>
              </div>

              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("people.field.mail")}</p>
                  <p className="mt-1 font-medium">{selectedPerson.mail || "-"}</p>
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("people.field.phone")}</p>
                  <p className="mt-1 font-medium">{selectedPhone}</p>
                  {selectedPerson.businessPhones.length > 0 ? (
                    <p className="mt-1 text-xs text-muted">
                      {selectedPerson.businessPhones.filter((p) => p !== selectedPhone && hasUsablePhone(p)).slice(0, 2).join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("people.field.office")}</p>
                  <p className="mt-1 font-medium">{selectedPerson.officeLocation}</p>
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("people.field.tenant")}</p>
                  <p className="mt-1 font-medium">{selectedPerson.tenantName}</p>
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("people.field.upn")}</p>
                  <p className="mt-1 font-medium">{selectedPerson.upn || "-"}</p>
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("people.field.sourceAccount")}</p>
                  <p className="mt-1 font-medium">{selectedPerson.sourceAccount || "-"}</p>
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("people.field.provider")}</p>
                  <p className="mt-1 font-medium">{providerLabel(selectedPerson.provider)}</p>
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("people.field.businessPhones")}</p>
                  <p className="mt-1 font-medium">
                    {selectedPerson.businessPhones.filter((p) => hasUsablePhone(p)).join(" · ") || "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("people.field.company")}</p>
                  <p className="mt-1 font-medium">{selectedPerson.companyName || "-"}</p>
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("people.field.employeeId")}</p>
                  <p className="mt-1 font-medium">{selectedPerson.employeeId || "-"}</p>
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("people.field.region")}</p>
                  <p className="mt-1 font-medium">{[selectedPerson.city, selectedPerson.state, selectedPerson.country].filter(Boolean).join(", ") || "-"}</p>
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("people.field.preferredLanguage")}</p>
                  <p className="mt-1 font-medium">{selectedPerson.preferredLanguage || "-"}</p>
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("people.field.userType")}</p>
                  <p className="mt-1 font-medium">{selectedPerson.userType || "-"}</p>
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("people.field.accountStatus")}</p>
                  <p className="mt-1 font-medium">{accountStatusLabel(selectedPerson.accountEnabled)}</p>
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("people.field.objectId")}</p>
                  <p className="mt-1 break-all font-medium">{selectedPerson.externalPersonId || "-"}</p>
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">{t("people.field.managerObjectId")}</p>
                  <p className="mt-1 break-all font-medium">{selectedPerson.managerExternalId || "-"}</p>
                </div>
              </div>
            </section>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
