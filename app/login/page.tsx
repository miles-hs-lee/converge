import Link from "next/link";
import { requestMagicLink } from "@/app/login/actions";

const loginStatusMessage: Record<string, string> = {
  magic_link_sent: "매직링크를 보냈습니다. 이메일에서 로그인 링크를 열어주세요.",
  invalid_email: "유효한 이메일 주소를 입력해주세요.",
  magic_link_error: "매직링크 전송에 실패했습니다. Supabase Auth 설정을 확인해주세요.",
  auth_callback_error: "로그인 콜백 처리에 실패했습니다."
};

type LoginPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const status = params.status;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <section className="card w-full p-8">
        <h1 className="text-2xl font-semibold">Converge 로그인</h1>
        <p className="mt-2 text-sm text-muted">메인 계정으로 로그인한 뒤 추가 M365 계정을 연결하세요.</p>

        {status && loginStatusMessage[status] ? (
          <p className="mt-4 rounded-lg border border-line bg-white p-3 text-sm">{loginStatusMessage[status]}</p>
        ) : null}

        <form action={requestMagicLink} className="mt-6 flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="email">
            이메일
          </label>
          <input
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none ring-accent focus:ring"
            id="email"
            name="email"
            placeholder="you@company.com"
            type="email"
            required
          />
          <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white" type="submit">
            매직링크 로그인
          </button>
        </form>

        <Link
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-line px-4 py-2 text-sm font-semibold"
          href="/api/auth/microsoft/start"
        >
          Microsoft 계정으로 계속
        </Link>

        <Link className="mt-4 inline-flex text-sm text-muted underline" href="/calendar">
          임시로 앱 들어가기
        </Link>
      </section>
    </main>
  );
}
