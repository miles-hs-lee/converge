"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock3,
  Search,
  Star
} from "lucide-react";
import { PeopleDetailModal } from "@/components/people-detail-modal";
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
  detailLoaded?: boolean;
};

type PeopleSearchPanelProps = {
  people: PersonRow[];
  serverSearchEnabled?: boolean;
  initialHasMore?: boolean;
};

const FAVORITES_STORAGE_KEY = "converge:favorites:people";
const RECENTS_STORAGE_KEY = "converge:recent:people";
const SEARCH_PAGE_SIZE = 60;
const VIRTUALIZATION_THRESHOLD = 120;
const VIRTUAL_HEADER_HEIGHT = 44;
const VIRTUAL_ROW_HEIGHT = 96;
const VIRTUAL_OVERSCAN_PX = 360;

type VirtualListItem =
  | { key: string; kind: "tenantHeader"; tenantName: string; count: number; collapsed: boolean }
  | { key: string; kind: "person"; person: PersonRow; hideTenant: boolean };

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

function isGuestPerson(person: PersonRow): boolean {
  const userType = (person.userType ?? "").trim().toLowerCase();
  if (userType === "guest") {
    return true;
  }
  const upn = (person.upn ?? "").toLowerCase();
  return upn.includes("#ext#");
}

export function PeopleSearchPanel({ people, serverSearchEnabled = false, initialHasMore = false }: PeopleSearchPanelProps) {
  const t = useT();
  const intl = useIntlLocale();

  const [query, setQuery] = useState("");
  const [loadedPeople, setLoadedPeople] = useState<PersonRow[]>(people);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"default" | "tenant">("tenant");
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [collapsedTenants, setCollapsedTenants] = useState<Record<string, boolean>>({});
  const [copiedField, setCopiedField] = useState<"mail" | "phone" | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [serverHasMore, setServerHasMore] = useState(initialHasMore);
  const [managerLookupTried, setManagerLookupTried] = useState<Set<string>>(() => new Set());
  const [detailLookupTried, setDetailLookupTried] = useState<Set<string>>(() => new Set());
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [includeGuests, setIncludeGuests] = useState(false);
  const listViewportRef = useRef<HTMLDivElement | null>(null);
  const [virtualScrollTop, setVirtualScrollTop] = useState(0);
  const [virtualViewportHeight, setVirtualViewportHeight] = useState(640);

  const deferredQuery = useDeferredValue(query.trim());
  const [debouncedQuery, setDebouncedQuery] = useState(deferredQuery);
  const activePeople = serverSearchEnabled ? loadedPeople : people;
  const visiblePeople = useMemo(() => {
    if (includeGuests) {
      return activePeople;
    }
    return activePeople.filter((person) => !isGuestPerson(person));
  }, [activePeople, includeGuests]);

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

  useEffect(() => {
    setLoadedPeople(people);
    setServerHasMore(initialHasMore);
  }, [initialHasMore, people, serverSearchEnabled]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(deferredQuery);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [deferredQuery]);

  async function fetchPeoplePage(params: { offset: number; append: boolean; queryValue: string; includeGuests: boolean; signal?: AbortSignal }) {
    const search = new URLSearchParams({
      mode: "summary",
      q: params.queryValue,
      offset: String(params.offset),
      limit: String(SEARCH_PAGE_SIZE),
      includeGuests: params.includeGuests ? "true" : "false"
    });
    const response = await fetch(`/api/people/search?${search.toString()}`, { cache: "no-store", signal: params.signal });
    if (!response.ok) {
      throw new Error("people_search_failed");
    }
    const json = (await response.json()) as { ok: boolean; items: PersonRow[]; hasMore?: boolean };
    if (!json.ok) {
      throw new Error("people_search_failed");
    }

    setLoadedPeople((prev) => {
      if (!params.append) {
        return json.items;
      }
      const existing = new Set(prev.map((item) => item.id));
      const next = json.items.filter((item) => !existing.has(item.id));
      return next.length > 0 ? [...prev, ...next] : prev;
    });
    setServerHasMore(Boolean(json.hasMore));
  }

  useEffect(() => {
    if (!serverSearchEnabled) {
      return;
    }
    if (!includeGuests && !debouncedQuery && people.length > 0) {
      setLoadedPeople(people);
      setServerHasMore(initialHasMore);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    fetchPeoplePage({ offset: 0, append: false, queryValue: debouncedQuery, includeGuests, signal: controller.signal })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadedPeople([]);
          setServerHasMore(false);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, includeGuests, initialHasMore, people, serverSearchEnabled]);

  const peopleById = useMemo(() => {
    return new Map(visiblePeople.map((person) => [person.id, person]));
  }, [visiblePeople]);
  const peopleByExternalId = useMemo(() => {
    return new Map(activePeople.map((person) => [person.externalPersonId, person]));
  }, [activePeople]);

  const favoritePeople = useMemo(() => {
    return favoriteIds.map((id) => peopleById.get(id)).filter((item): item is PersonRow => Boolean(item));
  }, [favoriteIds, peopleById]);

  const recentPeople = useMemo(() => {
    return recentIds.map((id) => peopleById.get(id)).filter((item): item is PersonRow => Boolean(item));
  }, [recentIds, peopleById]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (serverSearchEnabled) {
      return visiblePeople;
    }

    if (!q) {
      return visiblePeople;
    }

    const qDigits = digitsOnly(q);
    const wantsPhone = qDigits.length > 0;

    return visiblePeople.filter((person) => {
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
  }, [query, serverSearchEnabled, visiblePeople]);

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
    return activePeople.find((person) => person.id === selectedPersonId) ?? null;
  }, [activePeople, selectedPersonId]);
  const selectedManager = useMemo(() => {
    if (!selectedPerson?.managerExternalId) {
      return null;
    }
    return peopleByExternalId.get(selectedPerson.managerExternalId) ?? null;
  }, [peopleByExternalId, selectedPerson]);

  useEffect(() => {
    if (!serverSearchEnabled || !selectedPersonId) {
      setDetailLoadingId(null);
      return;
    }
    const target = activePeople.find((person) => person.id === selectedPersonId);
    if (!target || target.detailLoaded) {
      setDetailLoadingId(null);
      return;
    }
    if (detailLookupTried.has(target.id)) {
      return;
    }

    const controller = new AbortController();
    setDetailLookupTried((prev) => new Set(prev).add(target.id));
    setDetailLoadingId(target.id);

    const run = async () => {
      const search = new URLSearchParams({
        id: target.id,
        mode: "detail",
        includeGuests: "true",
        limit: "1"
      });
      const response = await fetch(`/api/people/search?${search.toString()}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) return;
      const json = (await response.json()) as { ok: boolean; items: PersonRow[] };
      if (!json.ok || !json.items?.[0]) return;
      const full = json.items[0];
      setLoadedPeople((prev) => prev.map((row) => (row.id === full.id ? { ...row, ...full, detailLoaded: true } : row)));
    };

    void run().finally(() => {
      if (!controller.signal.aborted) {
        setDetailLoadingId((current) => (current === target.id ? null : current));
      }
    });

    return () => {
      controller.abort();
    };
  }, [activePeople, detailLookupTried, selectedPersonId, serverSearchEnabled]);

  useEffect(() => {
    if (!serverSearchEnabled || !selectedPerson?.managerExternalId || selectedManager) {
      return;
    }
    if (managerLookupTried.has(selectedPerson.managerExternalId)) {
      return;
    }

    let cancelled = false;
    const managerExternalId = selectedPerson.managerExternalId;
    setManagerLookupTried((prev) => new Set(prev).add(managerExternalId));

    const run = async () => {
      const search = new URLSearchParams({
        mode: "summary",
        externalPersonId: managerExternalId,
        includeGuests: "true",
        limit: "1"
      });
      const response = await fetch(`/api/people/search?${search.toString()}`, { cache: "no-store" });
      if (!response.ok) return;
      const json = (await response.json()) as { ok: boolean; items: PersonRow[] };
      if (!json.ok || !json.items || json.items.length === 0) return;
      if (cancelled) return;
      setLoadedPeople((prev) => {
        const manager = json.items[0]!;
        if (prev.some((item) => item.id === manager.id)) {
          return prev;
        }
        return [...prev, manager];
      });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [managerLookupTried, selectedManager, selectedPerson, serverSearchEnabled]);

  const actionLinks = selectedPerson ? buildActionLinks(selectedPerson) : null;
  const selectedPhone = selectedPerson ? getPrimaryPhone(selectedPerson) : "";
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

  async function loadMore() {
    if (!serverSearchEnabled || !serverHasMore || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      await fetchPeoplePage({
        offset: loadedPeople.length,
        append: true,
        queryValue: debouncedQuery,
        includeGuests
      });
    } finally {
      setLoadingMore(false);
    }
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
      <article className="flex items-start gap-2 rounded-xl border border-line bg-white/90 p-2.5">
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

  const shouldVirtualize = filtered.length >= VIRTUALIZATION_THRESHOLD;

  const virtualItems = useMemo(() => {
    if (!shouldVirtualize) {
      return [] as VirtualListItem[];
    }

    if (sortMode === "default") {
      return filtered.map((person) => ({
        key: `person-${person.id}`,
        kind: "person" as const,
        person,
        hideTenant: false
      }));
    }

    const items: VirtualListItem[] = [];
    for (const group of tenantGroups) {
      const collapsed = Boolean(collapsedTenants[group.tenantName]);
      items.push({
        key: `tenant-${group.tenantName}`,
        kind: "tenantHeader",
        tenantName: group.tenantName,
        count: group.items.length,
        collapsed
      });

      if (!collapsed) {
        for (const person of group.items) {
          items.push({
            key: `person-${person.id}`,
            kind: "person",
            person,
            hideTenant: true
          });
        }
      }
    }
    return items;
  }, [collapsedTenants, filtered, shouldVirtualize, sortMode, tenantGroups]);

  const virtualLayout = useMemo(() => {
    if (!shouldVirtualize) {
      return { totalHeight: 0, rows: [] as Array<{ item: VirtualListItem; top: number; height: number; bottom: number }> };
    }
    let top = 0;
    const rows = virtualItems.map((item) => {
      const height = item.kind === "tenantHeader" ? VIRTUAL_HEADER_HEIGHT : VIRTUAL_ROW_HEIGHT;
      const row = { item, top, height, bottom: top + height };
      top += height;
      return row;
    });
    return { totalHeight: top, rows };
  }, [shouldVirtualize, virtualItems]);

  const visibleVirtualRows = useMemo(() => {
    if (!shouldVirtualize || virtualLayout.rows.length === 0) {
      return [] as Array<{ item: VirtualListItem; top: number; height: number; bottom: number }>;
    }

    const minY = Math.max(0, virtualScrollTop - VIRTUAL_OVERSCAN_PX);
    const maxY = virtualScrollTop + virtualViewportHeight + VIRTUAL_OVERSCAN_PX;
    let start = 0;
    while (start < virtualLayout.rows.length && virtualLayout.rows[start]!.bottom < minY) {
      start += 1;
    }
    let end = start;
    while (end < virtualLayout.rows.length && virtualLayout.rows[end]!.top <= maxY) {
      end += 1;
    }
    return virtualLayout.rows.slice(start, Math.max(start, end));
  }, [shouldVirtualize, virtualLayout.rows, virtualScrollTop, virtualViewportHeight]);

  useEffect(() => {
    if (!shouldVirtualize || !listViewportRef.current) {
      return;
    }

    const container = listViewportRef.current;
    setVirtualViewportHeight(container.clientHeight || 640);
    setVirtualScrollTop(container.scrollTop || 0);

    const observer = new ResizeObserver(() => {
      setVirtualViewportHeight(container.clientHeight || 640);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [shouldVirtualize]);

  useEffect(() => {
    if (!shouldVirtualize || !listViewportRef.current) {
      return;
    }
    listViewportRef.current.scrollTop = 0;
    setVirtualScrollTop(0);
  }, [debouncedQuery, includeGuests, shouldVirtualize, sortMode]);

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
        <div className="flex items-center gap-2">
          <button
            aria-pressed={includeGuests}
            className={`badge px-3 py-1.5 text-xs font-medium transition ${includeGuests ? "border-accent/50 bg-accent/10 text-accent" : "bg-white/90 text-muted"}`}
            onClick={() => setIncludeGuests((prev) => !prev)}
            type="button"
          >
            {t("people.filter.includeGuests")}
          </button>

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
        {loading ? <p className="text-xs text-muted">{t("people.loading")}</p> : null}

        {shouldVirtualize ? (
          <div
            className="max-h-[68vh] overflow-y-auto rounded-xl border border-line/70 bg-white/35 p-2"
            onScroll={(event) => setVirtualScrollTop(event.currentTarget.scrollTop)}
            ref={listViewportRef}
          >
            <div className="relative" style={{ height: `${virtualLayout.totalHeight}px` }}>
              {visibleVirtualRows.map((row) => {
                const item = row.item;
                if (item.kind === "tenantHeader") {
                  return (
                    <div className="absolute left-0 right-0 px-1" key={item.key} style={{ top: `${row.top}px`, height: `${row.height}px` }}>
                      <button
                        className="flex h-[38px] w-full items-center justify-between rounded-lg border border-line bg-white/85 px-2 text-left"
                        onClick={() => toggleTenant(item.tenantName)}
                        type="button"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{item.tenantName}</p>
                        <span className="inline-flex items-center gap-1 text-xs text-muted">
                          {t("people.searchCount", { count: item.count })}
                          {item.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </span>
                      </button>
                    </div>
                  );
                }
                return (
                  <div className="absolute left-0 right-0 px-1 py-1" key={item.key} style={{ top: `${row.top}px`, height: `${row.height}px` }}>
                    {renderPersonCard(item.person, { hideTenant: item.hideTenant })}
                  </div>
                );
              })}
            </div>
          </div>
        ) : sortMode === "default" ? (
          filtered.map((person) => <div key={person.id}>{renderPersonCard(person)}</div>)
        ) : (
          tenantGroups.map((group) => {
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
                {!collapsed ? (
                  <div className="mt-2 space-y-2">
                    {group.items.map((person) => (
                      <div key={person.id}>{renderPersonCard(person, { hideTenant: true })}</div>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })
        )}

        {!loading && filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-white/70 px-3 py-6 text-center text-muted">
            {t("people.noResults")}
          </div>
        ) : null}

        {serverSearchEnabled && !loading && serverHasMore ? (
          <div className="pt-1 text-center">
            <button className="btn btn-secondary px-3 py-1.5" disabled={loadingMore} onClick={() => void loadMore()} type="button">
              {loadingMore ? t("people.loading") : t("people.loadMore")}
            </button>
          </div>
        ) : null}
      </div>

      <PeopleDetailModal
        actionLinks={actionLinks}
        copiedField={copiedField}
        isLoading={detailLoadingId === selectedPerson?.id}
        isFavorite={selectedPerson ? favoriteIds.includes(selectedPerson.id) : false}
        manager={selectedManager}
        onClose={() => setSelectedPersonId(null)}
        onCopyMail={() => {
          if (selectedPerson) {
            void copyToClipboard(selectedPerson.mail, "mail");
          }
        }}
        onCopyPhone={() => {
          if (selectedPerson) {
            void copyToClipboard(selectedPhone, "phone");
          }
        }}
        onToggleFavorite={() => {
          if (selectedPerson) {
            toggleFavorite(selectedPerson.id);
          }
        }}
        onOpenManager={() => {
          if (selectedManager) {
            openPerson(selectedManager.id);
          }
        }}
        person={selectedPerson}
        selectedPhone={selectedPhone}
      />
    </>
  );
}
