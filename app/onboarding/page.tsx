import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-12">
      <section className="panel-glass card w-full p-8 md:p-10">
        <p className="text-xs uppercase tracking-[0.22em] text-accent">Converge</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">여러 M365 계정을 한 화면에서</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted md:text-base">
          통합 캘린더와 직원 검색을 빠르게 확인하고, 설정에서 계정을 추가 연결해 워크스페이스를 확장하세요.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-line bg-white px-3 py-1 text-xs">통합 캘린더</span>
          <span className="rounded-full border border-line bg-white px-3 py-1 text-xs">직원 검색</span>
          <span className="rounded-full border border-line bg-white px-3 py-1 text-xs">다중 계정 연결</span>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white" href="/login">
            시작하기
            <ArrowRight size={16} />
          </Link>
          <Link className="inline-flex rounded-xl border border-line bg-white px-5 py-3 text-sm" href="/calendar">
            캘린더 보기
          </Link>
        </div>
      </section>
    </main>
  );
}
