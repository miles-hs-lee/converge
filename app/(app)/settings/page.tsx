import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/(app)/actions";
import { isMockMode } from "@/lib/mock-mode";
import { mockConnections } from "@/lib/mock-data";
import { LanguageSelector } from "@/components/language-selector";
import { PwaInstall } from "@/components/pwa-install";
import { getServerLocale } from "@/lib/i18n-server";
import { intlLocale, t, type I18nKey } from "@/lib/i18n";

const statusMessageKey: Record<string, I18nKey> = {
  oauth_connected: "status.oauth_connected",
  oauth_error: "status.oauth_error",
  google_oauth_connected: "status.google_oauth_connected",
  google_oauth_error: "status.google_oauth_error",
  google_invalid_state: "status.google_invalid_state",
  google_missing_code: "status.google_missing_code",
  google_token_exchange_failed: "status.google_token_exchange_failed",
  google_token_payload_invalid: "status.google_token_payload_invalid",
  google_profile_failed: "status.google_profile_failed",
  google_profile_incomplete: "status.google_profile_incomplete",
  google_refresh_token_missing: "status.google_refresh_token_missing",
  google_oauth_connected_partial_sync: "status.google_oauth_connected_partial_sync",
  google_oauth_connected_sync_failed: "status.google_oauth_connected_sync_failed",
  google_config_missing: "status.google_config_missing",
  invalid_state: "status.invalid_state",
  missing_code: "status.missing_code",
  auth_required: "status.auth_required",
  token_exchange_failed: "status.token_exchange_failed",
  token_payload_invalid: "status.token_payload_invalid",
  graph_me_failed: "status.graph_me_failed",
  profile_incomplete: "status.profile_incomplete",
  db_primary_check_failed: "status.db_primary_check_failed",
  db_connection_read_failed: "status.db_connection_read_failed",
  db_app_user_failed: "status.db_app_user_failed",
  db_connection_upsert_failed: "status.db_connection_upsert_failed"
};

type SettingsPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const locale = await getServerLocale();
  const tt = (key: Parameters<typeof t>[1], vars?: Parameters<typeof t>[2]) => t(locale, key, vars);
  const intl = intlLocale(locale);

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
      {status && statusMessageKey[status] ? (
        <section className="panel-glass card border-accent/40 bg-accent/5 p-4 text-sm">{tt(statusMessageKey[status]!)}</section>
      ) : null}

      <section className="panel-glass card p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="title-xl">{tt("settings.title")}</h1>
            <p className="muted mt-1">{tt("settings.subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="btn btn-primary" href="/api/auth/microsoft/start">
              {tt("settings.addMicrosoft")}
            </Link>
            <a className="btn btn-secondary" href="/api/auth/google/start">
              {tt("settings.addGoogle")}
            </a>
          </div>
        </div>
      </section>

      <section className="panel-glass card p-5 md:p-6">
        <h2 className="title-lg">{tt("settings.languageTitle")}</h2>
        <p className="muted mt-1">{tt("settings.languageSubtitle")}</p>
        <div className="mt-4">
          <LanguageSelector initialLocale={locale} />
        </div>
      </section>

      <section className="panel-glass card p-5 md:p-6">
        <h2 className="title-lg">{tt("pwa.title")}</h2>
        <p className="muted mt-1">{tt("pwa.subtitle")}</p>
        <PwaInstall />
      </section>

      <section className="panel-glass card p-5 md:p-6">
        <h2 className="title-lg">{tt("settings.connectionsTitle")}</h2>
        {!user && !isMockMode ? (
          <p className="mt-3 text-sm text-muted">{tt("settings.connectionsLoginRequired")}</p>
        ) : connections.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{tt("settings.connectionsEmpty")}</p>
        ) : (
          <div className="mt-4 grid gap-2 text-sm">
            {connections.map((connection) => (
              <article className="rounded-xl border border-line bg-white/85 p-3" key={connection.id}>
                <p className="font-medium">{connection.m365_user_principal_name ?? tt("common.unknownAccount")}</p>
                <p className="mt-1 text-xs text-muted">
                  {connection.provider === "google" ? tt("settings.providerGoogle") : tt("settings.providerMicrosoft")} · {connection.status} ·{" "}
                  {tt("settings.expires")} {new Date(connection.token_expires_at).toLocaleString(intl)}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel-glass card p-5 md:p-6">
        <h2 className="title-lg">{tt("settings.sessionTitle")}</h2>
        <p className="muted mt-1">{tt("settings.sessionSubtitle")}</p>
        <form action={signOutAction}>
          <button className="btn btn-secondary mt-4" type="submit">
            {tt("settings.signOut")}
          </button>
        </form>
        <p className="mt-4 text-xs text-muted">
          Build{" "}
          <span className="font-mono">
            {(process.env.NEXT_PUBLIC_BUILD_SHA || "").slice(0, 7) || "local"}{" "}
            {process.env.NEXT_PUBLIC_BUILD_REF ? `(${process.env.NEXT_PUBLIC_BUILD_REF})` : ""}
          </span>
        </p>
      </section>
    </div>
  );
}
