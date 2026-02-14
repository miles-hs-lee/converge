export default function CalendarPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="card p-4">
        <h2 className="text-sm font-semibold">계정 필터</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>Primary Tenant - teal</li>
          <li>Partner Tenant - blue</li>
          <li>Personal Tenant - slate</li>
        </ul>
      </aside>

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">통합 캘린더</h1>
          <button className="rounded-lg border border-line px-3 py-2 text-sm">새로고침</button>
        </div>
        <div className="mt-4 rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">
          FullCalendar 연동 위치 (day/week, 충돌 하이라이트, 원본 테넌트 표시)
        </div>
      </section>
    </div>
  );
}
