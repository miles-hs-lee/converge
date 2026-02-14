import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const statusMessage: Record<string, string> = {
  oauth_connected: "Microsoft 계정 연결이 완료되었습니다.",
  oauth_error: "Microsoft 인증 중 오류가 발생했습니다.",
  invalid_state: "OAuth state 검증에 실패했습니다. 다시 시도해주세요.",
  missing_code: "인증 코드가 누락되었습니다.",
  auth_required: "먼저 Converge에 로그인해야 합니다.",
  token_exchange_failed: "토큰 교환에 실패했습니다. 앱 등록 설정을 확인해주세요.",
  token_payload_invalid: "토큰 응답이 유효하지 않습니다.",
  graph_me_failed: "Microsoft 프로필 조회에 실패했습니다.",
  profile_incomplete: "테넌트 또는 사용자 식별값을 읽지 못했습니다.",
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
    updated_at: string;
  }> = [];

  if (user) {
    const { data } = await supabase
      .from("m365_connections")
      .select("id,m365_user_principal_name,status,token_expires_at,updated_at")
      .order("updated_at", { ascending: false });
    connections = data ?? [];
  }

  return (
    <div className="space-y-4">
      {status && statusMessage[status] ? (
        <section className="card border-accent/40 bg-accent/5 p-4 text-sm">{statusMessage[status]}</section>
      ) : null}

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">설정</h1>
            <p className="text-sm text-muted">M365 추가 계정 연결 및 동기화 상태를 관리합니다.</p>
          </div>
          <Link
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
            href="/api/auth/microsoft/start"
          >
            계정 추가
          </Link>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="text-base font-semibold">연결된 계정</h2>
        {!user ? (
          <p className="mt-3 text-sm text-muted">Converge 로그인 후 계정 연결 정보를 조회할 수 있습니다.</p>
        ) : connections.length === 0 ? (
          <p className="mt-3 text-sm text-muted">아직 연결된 M365 계정이 없습니다.</p>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            {connections.map((connection) => (
              <div className="flex items-center justify-between rounded-lg border border-line p-3" key={connection.id}>
                <span>
                  {connection.m365_user_principal_name ?? "Unknown account"} · {connection.status} · Token exp{" "}
                  {new Date(connection.token_expires_at).toLocaleString("ko-KR")}
                </span>
                <button className="rounded border border-line px-2 py-1" type="button">
                  해제
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-4">
        <h2 className="text-base font-semibold">기본 옵션</h2>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <label className="flex flex-col gap-1">
            기본 시간대
            <select className="rounded-lg border border-line px-3 py-2">
              <option>Asia/Seoul</option>
              <option>UTC</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            동기화 간격
            <select className="rounded-lg border border-line px-3 py-2">
              <option>5분</option>
              <option>15분</option>
              <option>30분</option>
            </select>
          </label>
        </div>
      </section>
    </div>
  );
}
