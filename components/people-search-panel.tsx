"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type PersonRow = {
  id: string;
  displayName: string;
  mail: string;
  jobTitle: string;
  department: string;
  tenantName: string;
};

type PeopleSearchPanelProps = {
  people: PersonRow[];
};

export function PeopleSearchPanel({ people }: PeopleSearchPanelProps) {
  const [query, setQuery] = useState("");

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

  return (
    <>
      <input
        className="mt-4 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm outline-none ring-accent focus:ring"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="이름, 이메일, 부서, 테넌트 검색"
        type="search"
        value={query}
      />

      <p className="mt-3 text-xs text-muted">총 {filtered.length}명</p>

      <div className="mt-3 space-y-2 text-sm">
        {filtered.map((person) => (
          <Link
            className="block rounded-xl border border-line bg-white/80 px-3 py-3 transition hover:border-accent/50"
            href={`/people/${person.id}`}
            key={person.id}
          >
            {person.displayName} · {person.jobTitle} · {person.department} · {person.tenantName}
            <p className="mt-1 text-xs text-muted">{person.mail}</p>
          </Link>
        ))}

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-white/70 px-3 py-6 text-center text-muted">
            검색 결과가 없습니다.
          </div>
        ) : null}
      </div>
    </>
  );
}
