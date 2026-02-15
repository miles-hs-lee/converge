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

type PersonRow = {
  id: string;
  displayName: string;
  mail: string;
  jobTitle: string;
  department: string;
  tenantName: string;
  officeLocation: string;
  mobilePhone: string;
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
    ? `https://outlook.office.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(`${person.displayName} 미팅`)}&to=${encodeURIComponent(email)}&startdt=${encodeURIComponent(start.toISOString())}&enddt=${encodeURIComponent(end.toISOString())}`
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
  return Boolean(value && !value.includes("없음"));
}

export function PeopleSearchPanel({ people }: PeopleSearchPanelProps) {
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

    return people.filter((person) => {
      return (
        person.displayName.toLowerCase().includes(q) ||
        person.mail.toLowerCase().includes(q) ||
        person.department.toLowerCase().includes(q) ||
        person.tenantName.toLowerCase().includes(q)
      );
    });
  }, [people, query]);

  const sortedByTenant = useMemo(() => {
    return [...filtered].sort((a, b) => {
      return a.tenantName.localeCompare(b.tenantName, "ko") || a.displayName.localeCompare(b.displayName, "ko");
    });
  }, [filtered]);

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
          aria-label={isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
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
          placeholder="이름, 이메일, 부서, 테넌트 검색"
          type="search"
          value={query}
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">총 {filtered.length}명</p>
        <div className="inline-flex rounded-xl border border-line bg-white p-0.5 text-sm">
          <button
            className={`rounded-lg px-3 py-1.5 font-medium ${sortMode === "default" ? "bg-accent text-white" : "text-slate-700"}`}
            onClick={() => setSortMode("default")}
            type="button"
          >
            기본
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 font-medium ${sortMode === "tenant" ? "bg-accent text-white" : "text-slate-700"}`}
            onClick={() => setSortMode("tenant")}
            type="button"
          >
            테넌트 정렬
          </button>
        </div>
      </div>

      {showPinnedSections ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <section className="rounded-xl border border-line bg-white/80 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Star className="text-amber-500" size={14} />
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">즐겨찾기 직원</p>
            </div>
            {favoritePeople.length === 0 ? (
              <p className="text-xs text-muted">직원 상세에서 별 버튼으로 즐겨찾기를 추가하세요.</p>
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
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">최근 조회 직원</p>
            </div>
            {recentPeople.length === 0 ? (
              <p className="text-xs text-muted">직원 카드를 열어보면 최근 조회 목록이 쌓입니다.</p>
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
                      {group.items.length}명
                      {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </button>
                  {!collapsed ? <div className="mt-2 space-y-2">{group.items.map((person) => renderPersonCard(person, { hideTenant: true }))}</div> : null}
                </section>
              );
            })}

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-white/70 px-3 py-6 text-center text-muted">
            검색 결과가 없습니다.
          </div>
        ) : null}
      </div>

      {selectedPerson && actionLinks ? (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4" role="dialog" aria-modal="true">
            <button aria-label="닫기" className="absolute inset-0 cursor-default" onClick={() => setSelectedPersonId(null)} type="button" />

            <section className="panel-glass card relative z-10 max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-4 pb-7 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-accent">People Detail</p>
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
                    즐겨찾기
                  </button>
                  <button
                    className="btn btn-secondary px-3 py-1.5"
                    onClick={() => setSelectedPersonId(null)}
                    type="button"
                  >
                    <X size={14} /> 닫기
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
                  <Mail size={16} /> 메일 작성
                </a>
                <a
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${actionLinks.disabled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-line bg-white hover:border-accent/45"}`}
                  href={actionLinks.disabled ? undefined : actionLinks.teams}
                  rel="noreferrer"
                  target="_blank"
                >
                  <MessageSquareText size={16} /> Teams 채팅 열기
                </a>
                <a
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${actionLinks.disabled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-line bg-white hover:border-accent/45"}`}
                  href={actionLinks.disabled ? undefined : actionLinks.calendar}
                  rel="noreferrer"
                  target="_blank"
                >
                  <CalendarPlus size={16} /> 캘린더 약속 생성
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
                  {copiedField === "mail" ? "이메일 복사됨" : "이메일 복사"}
                </button>
                <button
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${hasUsablePhone(selectedPerson.mobilePhone) ? "border-line bg-white hover:border-accent/45" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"}`}
                  disabled={!hasUsablePhone(selectedPerson.mobilePhone)}
                  onClick={() => copyToClipboard(selectedPerson.mobilePhone, "phone")}
                  type="button"
                >
                  {copiedField === "phone" ? <Check size={16} /> : <Copy size={16} />}
                  {copiedField === "phone" ? "전화번호 복사됨" : "전화번호 복사"}
                </button>
              </div>

              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">이메일</p>
                  <p className="mt-1 font-medium">{selectedPerson.mail || "(email 없음)"}</p>
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">전화번호</p>
                  <p className="mt-1 font-medium">{selectedPerson.mobilePhone}</p>
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">오피스 위치</p>
                  <p className="mt-1 font-medium">{selectedPerson.officeLocation}</p>
                </div>
                <div className="rounded-xl border border-line bg-white/85 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted">소속 테넌트</p>
                  <p className="mt-1 font-medium">{selectedPerson.tenantName}</p>
                </div>
              </div>
            </section>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
