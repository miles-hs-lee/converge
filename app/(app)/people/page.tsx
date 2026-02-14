export default function PeoplePage() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <section className="card p-4">
        <h1 className="text-xl font-semibold">조직도 / 직원 검색</h1>
        <input
          className="mt-3 w-full rounded-lg border border-line px-3 py-2 text-sm"
          placeholder="이름, 이메일, 부서 검색"
          type="search"
        />
        <div className="mt-4 space-y-2 text-sm">
          <div className="rounded-lg border border-line p-3">김민수 · Platform Engineer · Primary Tenant</div>
          <div className="rounded-lg border border-line p-3">Alex Chen · Sales Lead · Partner Tenant</div>
        </div>
      </section>

      <aside className="card p-4">
        <h2 className="text-base font-semibold">프로필 상세</h2>
        <p className="mt-3 text-sm text-muted">사용자를 선택하면 직책/부서/연락처/소속 테넌트 정보가 표시됩니다.</p>
      </aside>
    </div>
  );
}
