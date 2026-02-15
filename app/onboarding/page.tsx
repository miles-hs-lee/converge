import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default function OnboardingPage() {
  return (
    <main className="page-wrap flex min-h-screen max-w-4xl items-center py-12">
      <section className="panel-glass card w-full p-8 md:p-10">
        <BrandLogo subtitle="Unified M365 Workspace" />
        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight md:text-5xl">여러 M365 계정을 하나의 워크스페이스로</h1>
        <p className="muted mt-4 max-w-2xl md:text-base">
          Converge는 여러 테넌트에 흩어진 캘린더와 직원 정보를 한 번에 연결해 빠르게 탐색할 수 있도록 설계되었습니다.
        </p>

        <div className="mt-7 grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border border-line bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">01</p>
            <h2 className="mt-2 text-sm font-semibold">Unified Calendar</h2>
            <p className="muted mt-1">계정별 일정을 주간/월간 뷰로 통합해 확인</p>
          </article>
          <article className="rounded-2xl border border-line bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">02</p>
            <h2 className="mt-2 text-sm font-semibold">People Search</h2>
            <p className="muted mt-1">다중 테넌트 조직 검색과 빠른 액션 지원</p>
          </article>
          <article className="rounded-2xl border border-line bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">03</p>
            <h2 className="mt-2 text-sm font-semibold">Fast Workspace</h2>
            <p className="muted mt-1">키 입력 중심의 빠른 탐색 경험 제공</p>
          </article>
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
