import Link from "next/link";

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-6 px-4 py-10">
      <section className="card p-8">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Step 1</p>
        <h1 className="mt-2 text-3xl font-semibold">여러 M365 계정을 한 화면으로</h1>
        <p className="mt-3 text-muted">
          Converge는 멀티 테넌트 캘린더 통합과 직원 검색을 빠르게 처리하는 업무 허브입니다.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="card p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-accent">Step 2</p>
          <h2 className="mt-2 text-xl font-semibold">권한 안내</h2>
          <p className="mt-2 text-sm text-muted">
            캘린더 읽기, 조직 사용자 기본 조회 권한이 필요합니다. 데이터는 암호화 저장됩니다.
          </p>
        </article>

        <article className="card p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-accent">Step 3</p>
          <h2 className="mt-2 text-xl font-semibold">첫 계정 연결</h2>
          <p className="mt-2 text-sm text-muted">메인 계정을 연결하고 초기 동기화를 시작합니다.</p>
          <Link
            className="mt-4 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
            href="/login"
          >
            시작하기
          </Link>
        </article>
      </section>
    </main>
  );
}
