import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { requestMagicLink } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/brand-logo";

const loginStatusMessage: Record<string, string> = {
  magic_link_sent: "매직링크를 보냈습니다. 이메일에서 로그인 링크를 열어주세요.",
  invalid_email: "유효한 이메일 주소를 입력해주세요.",
  magic_link_error: "매직링크 전송에 실패했습니다. Supabase Auth 설정을 확인해주세요.",
  auth_callback_error: "로그인 콜백 처리에 실패했습니다.",
  signed_out: "안전하게 로그아웃되었습니다."
};

type LoginPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const status = params.status;

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/calendar");
  }

  return (
    <main className="page-wrap flex min-h-screen max-w-md items-center py-12">
      <section className="panel-glass card w-full p-8">
        <BrandLogo subtitle="Unified M365 Workspace" />
        <h1 className="title-xl mt-4">로그인</h1>
        <p className="muted mt-2">메인 계정으로 로그인하고 바로 통합 캘린더를 확인하세요.</p>

        {status && loginStatusMessage[status] ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertCircle className="mt-0.5" size={16} />
            {loginStatusMessage[status]}
          </p>
        ) : null}

        <form action={requestMagicLink} className="mt-5 space-y-3">
          <label className="text-sm font-medium" htmlFor="email">
            이메일
          </label>
          <input className="input-control" id="email" name="email" placeholder="you@company.com" required type="email" />
          <button className="btn btn-primary w-full" type="submit">
            매직링크 로그인
          </button>
        </form>

        <Link className="btn btn-secondary mt-3 w-full" href="/api/auth/microsoft/start">
          Microsoft 계정으로 계속
        </Link>

        <Link className="mt-5 inline-flex text-sm text-muted underline" href="/onboarding">
          온보딩 보기
        </Link>
      </section>
    </main>
  );
}
