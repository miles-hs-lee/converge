import Link from "next/link";
import { AlertCircle, ArrowRight, Mail, Shield } from "lucide-react";
import { requestMagicLink } from "@/app/login/actions";

const loginStatusMessage: Record<string, string> = {
  magic_link_sent: "매직링크를 보냈습니다. 이메일에서 로그인 링크를 열어주세요.",
  invalid_email: "유효한 이메일 주소를 입력해주세요.",
  magic_link_error: "매직링크 전송에 실패했습니다. Supabase Auth 설정을 확인해주세요.",
  auth_callback_error: "로그인 콜백 처리에 실패했습니다.",
  signed_out: "안전하게 로그아웃되었습니다. 다시 로그인해 주세요."
};

type LoginPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const status = params.status;

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl gap-6 px-4 py-12 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="panel-glass card p-8 md:p-10">
        <p className="text-xs uppercase tracking-[0.24em] text-accent">Welcome Back</p>
        <h1 className="mt-3 text-3xl font-semibold md:text-4xl">Converge 로그인</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          메인 계정으로 세션을 만든 뒤 설정 탭에서 M365 계정을 연결하세요. 처음에는 읽기 권한 기반으로 동작하며,
          추후 동기화 정책을 세부 설정할 수 있습니다.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Login Option</p>
            <p className="mt-2 text-sm font-medium">매직링크</p>
            <p className="mt-1 text-xs text-muted">이메일 인증으로 Converge 세션 생성</p>
          </div>
          <div className="rounded-xl border border-line bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Account Connect</p>
            <p className="mt-2 text-sm font-medium">Microsoft OAuth</p>
            <p className="mt-1 text-xs text-muted">설정 탭에서 다중 테넌트 계정 연결</p>
          </div>
        </div>
      </section>

      <section className="panel-glass card p-8">
        <h2 className="text-xl font-semibold">빠른 시작</h2>

        {status && loginStatusMessage[status] ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertCircle className="mt-0.5" size={16} />
            {loginStatusMessage[status]}
          </p>
        ) : null}

        <form action={requestMagicLink} className="mt-5 flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="email">
            이메일
          </label>
          <div className="flex items-center rounded-xl border border-line bg-white px-3">
            <Mail className="text-muted" size={16} />
            <input
              className="w-full border-0 bg-transparent px-2 py-3 text-sm outline-none"
              id="email"
              name="email"
              placeholder="you@company.com"
              type="email"
              required
            />
          </div>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white" type="submit">
            매직링크 로그인
            <ArrowRight size={16} />
          </button>
        </form>

        <Link
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold"
          href="/api/auth/microsoft/start"
        >
          Microsoft 계정으로 계속
        </Link>

        <div className="mt-6 rounded-xl border border-line bg-white/70 p-3 text-xs text-muted">
          <p className="inline-flex items-center gap-2 font-medium text-slate-700">
            <Shield size={14} />
            보안 안내
          </p>
          <p className="mt-1 leading-5">토큰은 서버 측 저장소에 보관되며 클라이언트에 노출되지 않습니다.</p>
        </div>

        <Link className="mt-5 inline-flex text-sm text-muted underline" href="/onboarding">
          온보딩 다시 보기
        </Link>
      </section>
    </main>
  );
}
