const samplePeople = [
  "김민수 · Platform Engineer · Primary Tenant",
  "Alex Chen · Sales Lead · Partner Tenant",
  "윤아린 · Product Ops · Personal Tenant"
];

export default function PeoplePage() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <section className="panel-glass card p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-accent">People Finder</p>
        <h1 className="mt-2 text-xl font-semibold">조직도 / 직원 검색</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          여러 테넌트의 사용자 디렉터리를 통합 색인하여 이름, 이메일, 부서로 즉시 검색합니다. 검색 결과에서 소속
          테넌트를 함께 보여 중복 인원을 구분합니다.
        </p>

        <input
          className="mt-4 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm outline-none ring-accent focus:ring"
          placeholder="이름, 이메일, 부서 검색"
          type="search"
        />

        <div className="mt-4 space-y-2 text-sm">
          {samplePeople.map((person) => (
            <div
              className="rounded-xl border border-line bg-white/80 px-3 py-3 transition hover:border-accent/50"
              key={person}
            >
              {person}
            </div>
          ))}
        </div>
      </section>

      <aside className="panel-glass card p-5">
        <h2 className="text-base font-semibold">프로필 상세</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          사용자를 선택하면 직책, 부서, 연락처, 매니저, 소속 테넌트를 우측 패널에 표시합니다.
        </p>

        <div className="mt-5 rounded-xl border border-line bg-white/80 p-4 text-sm">
          <p className="font-medium">빠른 액션(예정)</p>
          <ul className="mt-2 space-y-1 text-muted">
            <li>1. 메일 작성</li>
            <li>2. Teams 채팅 열기</li>
            <li>3. 캘린더 약속 생성</li>
          </ul>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-white/80 p-4 text-xs text-muted">
          검색 성능 향상을 위해 `pg_trgm` 인덱스를 사용합니다.
        </div>
      </aside>
    </div>
  );
}
