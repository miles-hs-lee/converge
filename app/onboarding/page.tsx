import Link from "next/link";
import Image from "next/image";
import { BrandLogo } from "@/components/brand-logo";

export default function OnboardingPage() {
  return (
    <main className="page-wrap py-10 md:py-14">
      <section className="panel-glass card p-7 md:p-10">
        <BrandLogo subtitle="Unified M365 Workspace" />
        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight md:text-5xl">여러 M365 계정을 하나의 워크스페이스로</h1>
        <p className="muted mt-4 max-w-3xl md:text-base">
          Converge는 여러 테넌트에 흩어진 캘린더와 직원 정보를 한 번에 연결합니다. 계정을 추가하면 일정과 조직 정보를 통합해서
          보여주고, 검색과 빠른 액션으로 업무 전환 시간을 줄여줍니다.
        </p>

        <div className="mt-7 grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl border border-line bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">핵심 기능 1</p>
            <h2 className="mt-2 text-sm font-semibold">통합 캘린더</h2>
            <p className="muted mt-1">여러 테넌트 일정이 주간/월간으로 한 화면에 모입니다.</p>
          </article>
          <article className="rounded-2xl border border-line bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">핵심 기능 2</p>
            <h2 className="mt-2 text-sm font-semibold">직원 검색</h2>
            <p className="muted mt-1">이름/부서/테넌트로 검색하고 즉시 메일, Teams, 일정 생성으로 연결합니다.</p>
          </article>
          <article className="rounded-2xl border border-line bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">핵심 기능 3</p>
            <h2 className="mt-2 text-sm font-semibold">계정 관리</h2>
            <p className="muted mt-1">설정에서 추가 계정을 연결하고 연결 상태를 관리할 수 있습니다.</p>
          </article>
        </div>

        <section className="mt-8 rounded-2xl border border-line bg-white/80 p-5">
          <h2 className="title-lg">처음 시작은 이렇게</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <article className="rounded-xl border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Step 1</p>
              <p className="mt-2 text-sm font-medium">메인 계정 로그인</p>
              <p className="muted mt-1">Supabase 인증 또는 Microsoft 계정으로 로그인합니다.</p>
            </article>
            <article className="rounded-xl border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Step 2</p>
              <p className="mt-2 text-sm font-medium">추가 계정 연결</p>
              <p className="muted mt-1">설정에서 다른 테넌트 M365 계정을 연결합니다.</p>
            </article>
            <article className="rounded-xl border border-line bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">Step 3</p>
              <p className="mt-2 text-sm font-medium">캘린더/조직도 활용</p>
              <p className="muted mt-1">통합 일정 확인, 직원 검색, 빠른 액션까지 한 번에 수행합니다.</p>
            </article>
          </div>
        </section>

        <section className="mt-8 space-y-4">
          <div>
            <h2 className="title-lg">실제 기능 화면</h2>
            <p className="muted mt-1">현재 배포된 Converge 서비스 화면을 그대로 캡처한 이미지입니다.</p>
          </div>

          <div className="grid gap-4">
            <article className="rounded-2xl border border-line bg-white/85 p-3 md:p-4">
              <div className="relative overflow-hidden rounded-xl border border-line">
                <Image
                  alt="Converge 통합 캘린더 실제 화면"
                  className="max-h-[430px] w-full object-cover object-top"
                  height={1028}
                  priority
                  src="/onboarding/calendar-desktop.png"
                  width={1280}
                />
              </div>
              <p className="mt-3 text-sm font-medium">통합 캘린더</p>
              <p className="muted mt-1">테넌트별 일정을 하나의 캘린더에 모아 검색, 주간/월간 탐색, 상세 확인이 가능합니다.</p>
            </article>

            <article className="rounded-2xl border border-line bg-white/85 p-3 md:p-4">
              <div className="relative overflow-hidden rounded-xl border border-line">
                <Image
                  alt="Converge 조직도 검색 실제 화면"
                  className="max-h-[520px] w-full object-cover object-top"
                  height={3624}
                  src="/onboarding/people-desktop.png"
                  width={1280}
                />
              </div>
              <p className="mt-3 text-sm font-medium">조직도/직원 검색</p>
              <p className="muted mt-1">직원을 검색하고 상세 팝업에서 메일, Teams 채팅, 일정 생성 액션으로 바로 이동합니다.</p>
            </article>

            <article className="rounded-2xl border border-line bg-white/85 p-3 md:p-4">
              <div className="relative overflow-hidden rounded-xl border border-line">
                <Image
                  alt="Converge 설정 실제 화면"
                  className="max-h-[430px] w-full object-cover object-top"
                  height={758}
                  src="/onboarding/settings-desktop.png"
                  width={1280}
                />
              </div>
              <p className="mt-3 text-sm font-medium">설정/계정 연결 관리</p>
              <p className="muted mt-1">연결 계정 상태를 확인하고 추가 연결 또는 로그아웃을 관리할 수 있습니다.</p>
            </article>
          </div>
        </section>

        <div className="mt-9 flex flex-wrap gap-3">
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
