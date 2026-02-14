"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Mail, MessageSquareText, X } from "lucide-react";

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

export function PeopleSearchPanel({ people }: PeopleSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"default" | "tenant">("default");

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

  return (
    <>
      <input
        className="input-control mt-4"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="이름, 이메일, 부서, 테넌트 검색"
        type="search"
        value={query}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">총 {filtered.length}명</p>
        <div className="inline-flex rounded-xl border border-line bg-white p-0.5 text-sm">
          <button
            className={`rounded-lg px-3 py-1.5 ${sortMode === "default" ? "bg-slate-900 text-white" : "text-slate-700"}`}
            onClick={() => setSortMode("default")}
            type="button"
          >
            기본
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 ${sortMode === "tenant" ? "bg-slate-900 text-white" : "text-slate-700"}`}
            onClick={() => setSortMode("tenant")}
            type="button"
          >
            테넌트 정렬
          </button>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        {sortMode === "default"
          ? filtered.map((person) => (
              <button
                className="block w-full rounded-xl border border-line bg-white/80 px-3 py-3 text-left transition hover:border-accent/50"
                key={person.id}
                onClick={() => setSelectedPersonId(person.id)}
                type="button"
              >
                {person.displayName} · {person.jobTitle} · {person.department} · {person.tenantName}
                <p className="mt-1 text-xs text-muted">{person.mail}</p>
              </button>
            ))
          : tenantGroups.map((group) => (
              <section className="rounded-xl border border-line bg-white/70 p-2" key={group.tenantName}>
                <div className="flex items-center justify-between px-1 py-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{group.tenantName}</p>
                  <p className="text-xs text-muted">{group.items.length}명</p>
                </div>
                <div className="space-y-2">
                  {group.items.map((person) => (
                    <button
                      className="block w-full rounded-xl border border-line bg-white px-3 py-3 text-left transition hover:border-accent/50"
                      key={person.id}
                      onClick={() => setSelectedPersonId(person.id)}
                      type="button"
                    >
                      {person.displayName} · {person.jobTitle} · {person.department}
                      <p className="mt-1 text-xs text-muted">{person.mail}</p>
                    </button>
                  ))}
                </div>
              </section>
            ))}

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-white/70 px-3 py-6 text-center text-muted">
            검색 결과가 없습니다.
          </div>
        ) : null}
      </div>

      {selectedPerson && actionLinks ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true">
          <button aria-label="닫기" className="absolute inset-0 cursor-default" onClick={() => setSelectedPersonId(null)} type="button" />

          <section className="relative z-10 w-full max-w-2xl rounded-2xl border border-line bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-accent">People Detail</p>
                <h3 className="mt-1 text-xl font-semibold">{selectedPerson.displayName}</h3>
                <p className="mt-1 text-sm text-muted">
                  {selectedPerson.jobTitle} · {selectedPerson.department} · {selectedPerson.tenantName}
                </p>
              </div>
              <button
                className="btn btn-secondary px-3 py-1.5"
                onClick={() => setSelectedPersonId(null)}
                type="button"
              >
                <X size={14} /> 닫기
              </button>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <a
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${actionLinks.disabled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-line bg-white hover:border-accent/50"}`}
                href={actionLinks.disabled ? undefined : actionLinks.mailto}
                rel="noreferrer"
                target="_blank"
              >
                <Mail size={16} /> 메일 작성
              </a>
              <a
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${actionLinks.disabled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-line bg-white hover:border-accent/50"}`}
                href={actionLinks.disabled ? undefined : actionLinks.teams}
                rel="noreferrer"
                target="_blank"
              >
                <MessageSquareText size={16} /> Teams 채팅 열기
              </a>
              <a
                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${actionLinks.disabled ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400" : "border-line bg-white hover:border-accent/50"}`}
                href={actionLinks.disabled ? undefined : actionLinks.calendar}
                rel="noreferrer"
                target="_blank"
              >
                <CalendarPlus size={16} /> 캘린더 약속 생성
              </a>
            </div>

            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <div className="rounded-xl border border-line bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted">이메일</p>
                <p className="mt-1 font-medium">{selectedPerson.mail || "(email 없음)"}</p>
              </div>
              <div className="rounded-xl border border-line bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted">전화번호</p>
                <p className="mt-1 font-medium">{selectedPerson.mobilePhone}</p>
              </div>
              <div className="rounded-xl border border-line bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted">오피스 위치</p>
                <p className="mt-1 font-medium">{selectedPerson.officeLocation}</p>
              </div>
              <div className="rounded-xl border border-line bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted">소속 테넌트</p>
                <p className="mt-1 font-medium">{selectedPerson.tenantName}</p>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
