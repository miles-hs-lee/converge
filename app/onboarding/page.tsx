import Link from "next/link";

export default function OnboardingPage() {
  return (
    <main className="page-wrap flex min-h-screen max-w-4xl items-center py-12">
      <section className="panel-glass card w-full p-8 md:p-10">
        <p className="text-xs uppercase tracking-[0.22em] text-accent">Converge</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">여러 M365 계정을 한 화면에서</h1>
        <p className="muted mt-4 max-w-2xl md:text-base">통합 캘린더와 직원 검색을 빠르게 확인하세요.</p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="badge">통합 캘린더</span>
          <span className="badge">직원 검색</span>
          <span className="badge">다중 계정 연결</span>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="btn btn-primary" href="/login">
            시작하기
          </Link>
          <Link className="btn btn-secondary" href="/calendar">
            캘린더 보기
          </Link>
        </div>
      </section>
    </main>
  );
}
