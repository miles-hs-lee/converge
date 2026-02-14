import Link from "next/link";
import { ArrowRight, CalendarClock, ShieldCheck, UsersRound } from "lucide-react";

const highlights = [
  {
    title: "통합 일정 보드",
    description: "여러 테넌트 캘린더를 색상 기준으로 합쳐 보고, 중복 시간을 즉시 파악합니다.",
    icon: CalendarClock
  },
  {
    title: "크로스 테넌트 직원 검색",
    description: "이름, 메일, 부서 기반 검색을 한 번에 실행하고 소속 테넌트를 함께 확인합니다.",
    icon: UsersRound
  },
  {
    title: "명확한 권한 통제",
    description: "읽기 권한 중심으로 시작하며, 연결 계정 단위로 해제/재연결 정책을 관리합니다.",
    icon: ShieldCheck
  }
];

export default function OnboardingPage() {
  return (
    <main className="hero-grid mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-6 px-4 py-12">
      <section className="panel-glass card overflow-hidden p-8 md:p-10">
        <p className="text-xs uppercase tracking-[0.24em] text-accent">Converge Onboarding</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight md:text-5xl">
          여러 M365 테넌트를 위한
          <br />
          빠르고 정리된 업무 허브
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted md:text-base">
          메인 계정 로그인 후 추가 계정을 연결하면 캘린더와 직원 정보를 단일 워크스페이스로 통합합니다.
          온보딩 단계에서 필요한 권한과 데이터 처리 기준을 먼저 안내해 안정적으로 시작할 수 있습니다.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110"
            href="/login"
          >
            시작하기
            <ArrowRight size={16} />
          </Link>
          <Link className="inline-flex rounded-xl border border-line bg-white px-5 py-3 text-sm font-medium" href="/settings">
            연결 설정 먼저 보기
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {highlights.map((item) => {
          const Icon = item.icon;
          return (
            <article className="panel-glass card p-6" key={item.title}>
              <div className="inline-flex rounded-lg bg-sky-50 p-2 text-sky-700">
                <Icon size={18} />
              </div>
              <h2 className="mt-4 text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
            </article>
          );
        })}
      </section>

      <section className="panel-glass card p-6 md:p-8">
        <h2 className="text-lg font-semibold">시작 전 체크리스트</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>1. Supabase Auth Redirect URL에 `/auth/callback`이 등록되어 있어야 합니다.</li>
          <li>2. Azure Redirect URI에 `/api/auth/microsoft/callback`이 등록되어 있어야 합니다.</li>
          <li>3. 첫 연결은 메인 계정으로 진행하고, 이후 설정에서 테넌트를 추가하세요.</li>
        </ul>
      </section>
    </main>
  );
}
