import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/(app)/actions";
import { isMockMode } from "@/lib/mock-mode";
import { mockConnections } from "@/lib/mock-data";

const statusMessage: Record<string, string> = {
  oauth_connected: "Microsoft 계정 연결이 완료되었습니다.",
  oauth_error: "Microsoft 인증 중 오류가 발생했습니다.",
  google_oauth_connected: "Google 계정 연결이 완료되었습니다.",
  google_oauth_error: "Google 인증 중 오류가 발생했습니다.",
  google_invalid_state: "Google OAuth state 검증에 실패했습니다.",
  google_missing_code: "Google 인증 코드가 누락되었습니다.",
  google_token_exchange_failed: "Google 토큰 교환에 실패했습니다.",
  google_token_payload_invalid: "Google 토큰 응답이 유효하지 않습니다.",
  google_profile_failed: "Google 프로필 조회에 실패했습니다.",
  google_profile_incomplete: "Google 프로필 정보가 불완전합니다.",
  google_refresh_token_missing: "Google refresh token을 받지 못했습니다. 다시 연결해주세요.",
  google_oauth_connected_partial_sync: "Google 계정 연결은 완료되었지만 일부 캘린더 동기화에 실패했습니다.",
  google_oauth_connected_sync_failed: "Google 계정 연결은 완료되었지만 초기 캘린더 동기화에 실패했습니다.",
  google_config_missing: "Google OAuth 설정이 누락되었습니다.",
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
    provider: string;
    m365_user_principal_name: string | null;
    status: string;
    token_expires_at: string;
  }> = [];

  if (isMockMode) {
    connections = mockConnections.map((connection) => ({
      id: connection.id,
      provider: "microsoft",
      m365_user_principal_name: connection.principalName,
      status: connection.status,
      token_expires_at: connection.tokenExpiresAt
    }));
  } else if (user) {
    const { data } = await supabase
      .from("m365_connections")
      .select("id,provider,m365_user_principal_name,status,token_expires_at")
      .order("updated_at", { ascending: false });
    connections = data ?? [];
  }

  return (
    <div className="space-y-4">
      {status && statusMessage[status] ? (
        <section className="panel-glass card border-accent/40 bg-accent/5 p-4 text-sm">{statusMessage[status]}</section>
      ) : null}

      <section className="panel-glass card p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="title-xl">설정</h1>
            <p className="muted mt-1">M365 계정 연결 상태와 세션을 관리합니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="btn btn-primary" href="/api/auth/microsoft/start">
              Microsoft 계정 추가
            </Link>
            <a className="btn btn-secondary" href="/api/auth/google/start">
              Google 캘린더 추가
            </a>
          </div>
        </div>
      </section>

      <section className="panel-glass card p-5 md:p-6">
        <h2 className="title-lg">연결 계정</h2>
        {!user && !isMockMode ? (
          <p className="mt-3 text-sm text-muted">로그인 후 연결 정보를 확인할 수 있습니다.</p>
        ) : connections.length === 0 ? (
          <p className="mt-3 text-sm text-muted">연결된 계정이 없습니다.</p>
        ) : (
          <div className="mt-4 grid gap-2 text-sm">
            {connections.map((connection) => (
              <article className="rounded-xl border border-line bg-white/85 p-3" key={connection.id}>
                <p className="font-medium">{connection.m365_user_principal_name ?? "Unknown account"}</p>
                <p className="mt-1 text-xs text-muted">
                  {connection.provider === "google" ? "Google" : "Microsoft"} · {connection.status} · 만료{" "}
                  {new Date(connection.token_expires_at).toLocaleString("ko-KR")}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel-glass card p-5 md:p-6">
        <h2 className="title-lg">세션</h2>
        <p className="muted mt-1">현재 디바이스에서 안전하게 로그아웃합니다.</p>
        <form action={signOutAction}>
          <button className="btn btn-secondary mt-4" type="submit">
            로그아웃
          </button>
        </form>
      </section>
    </div>
  );
}
