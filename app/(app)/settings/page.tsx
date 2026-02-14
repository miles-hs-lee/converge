import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/(app)/actions";
import { isMockMode } from "@/lib/mock-mode";
import { mockConnections } from "@/lib/mock-data";

const statusMessage: Record<string, string> = {
  oauth_connected: "Microsoft 계정 연결이 완료되었습니다.",
  oauth_error: "Microsoft 인증 중 오류가 발생했습니다.",
  invalid_state: "OAuth state 검증에 실패했습니다.",
  missing_code: "인증 코드가 누락되었습니다.",
  auth_required: "먼저 로그인해 주세요.",
  token_exchange_failed: "토큰 교환에 실패했습니다.",
  token_payload_invalid: "토큰 응답이 유효하지 않습니다.",
  graph_me_failed: "Microsoft 프로필 조회에 실패했습니다.",
  profile_incomplete: "프로필 정보가 불완전합니다.",
  db_primary_check_failed: "기존 연결 상태 확인 중 오류가 발생했습니다.",
  db_connection_read_failed: "연결 계정 조회 중 오류가 발생했습니다.",
  db_app_user_failed: "앱 사용자 저장에 실패했습니다.",
  db_connection_upsert_failed: "연결 계정 저장에 실패했습니다."
};

type SettingsPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const status = params.status;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let connections: Array<{
    id: string;
    m365_user_principal_name: string | null;
    status: string;
    token_expires_at: string;
  }> = [];

  if (isMockMode) {
    connections = mockConnections.map((connection) => ({
      id: connection.id,
      m365_user_principal_name: connection.principalName,
      status: connection.status,
      token_expires_at: connection.tokenExpiresAt
    }));
  } else if (user) {
    const { data } = await supabase
      .from("m365_connections")
      .select("id,m365_user_principal_name,status,token_expires_at")
      .order("updated_at", { ascending: false });
    connections = data ?? [];
  }

  return (
    <div className="space-y-4">
      {status && statusMessage[status] ? (
        <section className="panel-glass card border-accent/40 bg-accent/5 p-4 text-sm">{statusMessage[status]}</section>
      ) : null}

      <section className="panel-glass card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">설정</h1>
            <p className="mt-1 text-sm text-muted">M365 계정 연결 및 세션 관리</p>
          </div>
          <Link className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white" href="/api/auth/microsoft/start">
            계정 추가
          </Link>
        </div>
      </section>

      <section className="panel-glass card p-5">
        <h2 className="text-base font-semibold">연결 계정</h2>
        {!user && !isMockMode ? (
          <p className="mt-3 text-sm text-muted">로그인 후 연결 정보를 확인할 수 있습니다.</p>
        ) : connections.length === 0 ? (
          <p className="mt-3 text-sm text-muted">연결된 계정이 없습니다.</p>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            {connections.map((connection) => (
              <div className="rounded-xl border border-line bg-white/80 p-3" key={connection.id}>
                <p className="font-medium">{connection.m365_user_principal_name ?? "Unknown account"}</p>
                <p className="mt-1 text-xs text-muted">
                  {connection.status} · 만료 {new Date(connection.token_expires_at).toLocaleString("ko-KR")}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel-glass card p-5">
        <form action={signOutAction}>
          <button className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold" type="submit">
            로그아웃
          </button>
        </form>
      </section>
    </div>
  );
}
