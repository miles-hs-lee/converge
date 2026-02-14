const tenantLegend = [
  { name: "Primary Tenant", color: "bg-teal-500" },
  { name: "Partner Tenant", color: "bg-sky-500" },
  { name: "Personal Tenant", color: "bg-slate-500" }
];

export default function CalendarPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="panel-glass card p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-accent">Calendar Workspace</p>
        <h1 className="mt-2 text-xl font-semibold">통합 캘린더</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          연결된 계정의 이벤트를 하나의 타임라인으로 통합해 보여줍니다. 계정별 색상으로 출처를 구분하고 충돌
          슬롯을 빠르게 파악할 수 있습니다.
        </p>

        <div className="mt-5 space-y-2">
          {tenantLegend.map((item) => (
            <div className="flex items-center gap-2 text-sm" key={item.name}>
              <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
              <span>{item.name}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-line bg-white/80 p-4 text-xs text-muted">
          <p className="font-medium text-slate-700">동기화 동작</p>
          <p className="mt-1 leading-5">기본적으로 읽기 전용이며 설정 탭에서 동기화 주기와 계정 선택을 조정합니다.</p>
        </div>
      </aside>

      <section className="panel-glass card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted">View</p>
            <h2 className="text-lg font-semibold">Week Focus</h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-xl border border-line bg-white px-3 py-2 text-sm">오늘</button>
            <button className="rounded-xl border border-line bg-white px-3 py-2 text-sm">새로고침</button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-dashed border-line bg-white/70 p-10 text-center">
          <p className="text-base font-medium">FullCalendar 연결 영역</p>
          <p className="mt-2 text-sm text-muted">
            `day/week` 전환, 충돌 하이라이트, 원본 테넌트 배지를 이 섹션에 렌더링합니다.
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-line bg-white/80 p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Events Today</p>
            <p className="mt-2 text-2xl font-semibold">14</p>
          </div>
          <div className="rounded-xl border border-line bg-white/80 p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Conflict Slots</p>
            <p className="mt-2 text-2xl font-semibold text-rose-600">2</p>
          </div>
          <div className="rounded-xl border border-line bg-white/80 p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">Connected Tenants</p>
            <p className="mt-2 text-2xl font-semibold">3</p>
          </div>
        </div>
      </section>
    </div>
  );
}
