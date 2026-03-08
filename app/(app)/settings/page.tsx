import Link from "next/link";
import { AlertTriangle, Building2, CheckCircle2, ShieldCheck, Waypoints } from "lucide-react";
import { deleteConnectionAction, manualSyncAction, signOutAction } from "@/app/(app)/actions";
import { isMockMode } from "@/lib/mock-mode";
import { mockConnections } from "@/lib/mock-data";
import { LanguageSelector } from "@/components/language-selector";
import { PwaInstall } from "@/components/pwa-install";
import { PushNotificationsPanel } from "@/components/push-notifications-panel";
import { ThemeSelector } from "@/components/theme-selector";
import { CalendarLayoutSelector } from "@/components/calendar-layout-selector";
import { TenantColorSettings } from "@/components/tenant-color-settings";
import { ManualSyncForm } from "@/components/manual-sync-form";
import { LocalizedDateTime } from "@/components/localized-datetime";
import { getServerLocale } from "@/lib/i18n-server";
import { t, type I18nKey } from "@/lib/i18n";
import { requiredMicrosoftGraphScopes } from "@/lib/microsoft";
import { fetchSettingsPageData, type SessionLoginTimestamps, type SettingsConnectionRecord } from "@/lib/data/settings-data";

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
  db_connection_upsert_failed: "status.db_connection_upsert_failed",
  db_connection_secret_upsert_failed: "status.db_connection_secret_upsert_failed",
  security_reauth_required: "status.security_reauth_required",
  connection_deleted: "status.connection_deleted",
  connection_delete_failed: "status.connection_delete_failed",
  manual_sync_done: "status.manual_sync_done",
  manual_sync_partial: "status.manual_sync_partial",
  manual_sync_failed: "status.manual_sync_failed",
  manual_sync_rate_limited: "status.manual_sync_rate_limited"
};

type SettingsPageProps = {
  searchParams: Promise<{ status?: string }>;
};

function normalizeScopeKey(scope: string): string {
  return scope.trim().toLowerCase().replace(/^https:\/\/graph\.microsoft\.com\//, "");
}

function connectionStatusKey(status: string): I18nKey {
  if (status === "active") return "settings.connectionStatus.active";
  if (status === "revoked") return "settings.connectionStatus.revoked";
  return "settings.connectionStatus.other";
}

function connectionStatusClass(status: string): string {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "revoked") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-slate-200 bg-slate-100 text-slate-700";
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const locale = await getServerLocale({ dbFallback: true });
  const tt = (key: Parameters<typeof t>[1], vars?: Parameters<typeof t>[2]) => t(locale, key, vars);

  const params = await searchParams;
  const status = params.status;
  const syncStatus =
    status === "manual_sync_done" ||
    status === "manual_sync_partial" ||
    status === "manual_sync_failed" ||
    status === "manual_sync_rate_limited"
      ? status
      : null;

  let user: Awaited<ReturnType<typeof fetchSettingsPageData>>["user"] = null;
  let connections: SettingsConnectionRecord[] = [];
  let sessionLogins: SessionLoginTimestamps = {
    lastLoginAt: null,
    prevLoginAt: null
  };

  if (isMockMode) {
    connections = mockConnections.map((connection) => ({
      id: connection.id,
      provider: "microsoft",
      tenant_name: connection.tenantName,
      m365_user_principal_name: connection.principalName,
      status: connection.status,
      token_expires_at: connection.tokenExpiresAt,
      scopes: ["User.Read", "User.Read.All", "Calendars.Read", "Calendars.Read.Shared"]
    }));
    const now = Date.now();
    sessionLogins = {
      lastLoginAt: new Date(now).toISOString(),
      prevLoginAt: new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString()
    };
  } else {
    const settingsData = await fetchSettingsPageData();
    user = settingsData.user;
    connections = settingsData.connections;
    sessionLogins = settingsData.sessionLogins;
  }

  const tenantNames = connections.map((connection) => connection.tenant_name ?? "").filter(Boolean);
  const totalConnections = connections.length;
  const activeConnections = connections.filter((connection) => connection.status === "active").length;
  const reauthConnections = connections.filter((connection) => connection.status === "revoked").length;
  const providerCount = new Set(connections.map((connection) => connection.provider)).size;
  const hasReauthRequired = reauthConnections > 0;

  return (
    <div className="space-y-4">
      {status && statusMessageKey[status] ? (
        <section className="panel-glass card border-accent/40 bg-accent/5 p-4 text-sm">{tt(statusMessageKey[status]!)}</section>
      ) : null}
      {hasReauthRequired ? (
        <section className="panel-glass card border-amber-300/60 bg-amber-50/90 p-4 text-sm text-amber-900">{tt("settings.reauthInline")}</section>
      ) : null}

      <section className="panel-glass card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="title-xl">{tt("settings.title")}</h1>
            <p className="muted mt-1">{tt("settings.subtitle")}</p>
          </div>
          {user ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link className="btn btn-primary" href="/api/auth/microsoft/start">
                {tt("settings.addMicrosoft")}
              </Link>
              <Link className="btn btn-secondary" href="/api/auth/google/start">
                {tt("settings.addGoogle")}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-xl border border-line bg-white/85 p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{tt("settings.summaryConnected")}</p>
              <Building2 className="text-accent" size={15} />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-text">{totalConnections}</p>
          </article>
          <article className="rounded-xl border border-line bg-white/85 p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{tt("settings.summaryActive")}</p>
              <CheckCircle2 className="text-emerald-600" size={15} />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-text">{activeConnections}</p>
          </article>
          <article className="rounded-xl border border-line bg-white/85 p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{tt("settings.summaryReauth")}</p>
              <AlertTriangle className="text-amber-600" size={15} />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-text">{reauthConnections}</p>
          </article>
          <article className="rounded-xl border border-line bg-white/85 p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{tt("settings.summaryProviders")}</p>
              <Waypoints className="text-sky-600" size={15} />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-text">{providerCount}</p>
          </article>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="panel-glass card p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="title-lg">{tt("settings.connectionsTitle")}</h2>
                <p className="muted mt-1">{tt("settings.subtitle")}</p>
              </div>
              {user ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Link className="btn btn-secondary px-3 py-1.5 text-xs" href="/api/auth/microsoft/start">
                    {tt("settings.addMicrosoft")}
                  </Link>
                  <Link className="btn btn-secondary px-3 py-1.5 text-xs" href="/api/auth/google/start">
                    {tt("settings.addGoogle")}
                  </Link>
                </div>
              ) : null}
            </div>

            {!user && !isMockMode ? (
              <p className="mt-3 text-sm text-muted">{tt("settings.connectionsLoginRequired")}</p>
            ) : connections.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{tt("settings.connectionsEmpty")}</p>
            ) : (
              <div className="mt-4 grid gap-3 text-sm">
                {connections.map((connection) => {
                  const grantedScopes = new Set((connection.scopes ?? []).map((scope) => normalizeScopeKey(scope)));
                  const hasMissingRequired = requiredMicrosoftGraphScopes.some((scope) => !grantedScopes.has(normalizeScopeKey(scope)));
                  const statusKey = connectionStatusKey(connection.status);
                  return (
                    <article className="rounded-xl border border-line bg-white/85 p-4" key={connection.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-text">{connection.m365_user_principal_name ?? tt("common.unknownAccount")}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="badge px-2.5 py-0.5 text-[11px]">
                              {connection.provider === "google" ? tt("settings.providerGoogle") : tt("settings.providerMicrosoft")}
                            </span>
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${connectionStatusClass(connection.status)}`}>
                              {tt(statusKey)}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-muted">
                            {tt("settings.expires")}{" "}
                            <LocalizedDateTime
                              emptyText="-"
                              iso={connection.token_expires_at}
                              options={{ year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }}
                            />
                          </p>
                        </div>

                        {!isMockMode && user ? (
                          <div className="flex items-center gap-2">
                            {connection.status === "revoked" ? (
                              <Link
                                className="btn btn-primary px-3 py-1.5 text-xs"
                                href={connection.provider === "google" ? "/api/auth/google/start" : "/api/auth/microsoft/start"}
                              >
                                {tt("settings.reauthModalCta")}
                              </Link>
                            ) : null}
                            <form action={deleteConnectionAction}>
                              <input name="connectionId" type="hidden" value={connection.id} />
                              <button className="btn btn-danger px-3 py-1.5 text-xs" type="submit">
                                {tt("settings.removeConnection")}
                              </button>
                            </form>
                          </div>
                        ) : null}
                      </div>

                      {connection.provider === "microsoft" ? (
                        <div className="mt-3 space-y-1.5 border-t border-line/70 pt-3">
                          <p className="text-[11px] font-medium text-muted">{tt("settings.graphScopeCheck")}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {requiredMicrosoftGraphScopes.map((scope) => {
                              const granted = grantedScopes.has(normalizeScopeKey(scope));
                              return (
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${granted ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}
                                  key={scope}
                                >
                                  {scope} · {granted ? tt("settings.scopeGranted") : tt("settings.scopeMissing")}
                                </span>
                              );
                            })}
                          </div>
                          {hasMissingRequired ? <p className="text-[11px] text-muted">{tt("settings.graphScopeMissingHint")}</p> : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}

            <div className="mt-5 border-t border-line/70 pt-5">
              <h3 className="text-base font-semibold tracking-tight text-text">{tt("settings.syncTitle")}</h3>
              <p className="muted mt-1">{tt("settings.syncSubtitle")}</p>
              {syncStatus ? (
                <p
                  className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
                    syncStatus === "manual_sync_done"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : syncStatus === "manual_sync_partial" || syncStatus === "manual_sync_rate_limited"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                >
                  {tt(statusMessageKey[syncStatus]!)}
                </p>
              ) : null}
              {user ? (
                <ManualSyncForm
                  action={manualSyncAction}
                  labels={{
                    syncAll: tt("settings.syncAll"),
                    syncCalendar: tt("settings.syncCalendar"),
                    syncPeople: tt("settings.syncPeople"),
                    syncing: tt("settings.syncing"),
                    progressHint: tt("settings.syncProgressHint")
                  }}
                />
              ) : (
                <p className="mt-3 text-sm text-muted">{tt("settings.connectionsLoginRequired")}</p>
              )}
            </div>

            <div className="mt-5 border-t border-line/70 pt-5">
              <h3 className="text-base font-semibold tracking-tight text-text">{tt("settings.tenantColorsTitle")}</h3>
              <p className="muted mt-1">{tt("settings.tenantColorsSubtitle")}</p>
              <TenantColorSettings tenants={tenantNames} />
            </div>
          </section>

          <section className="panel-glass card p-5 md:p-6">
            <h2 className="title-lg">{tt("push.title")}</h2>
            <p className="muted mt-1">{tt("push.subtitle")}</p>
            <PushNotificationsPanel enabled={Boolean(user)} />
          </section>
        </div>

        <div className="space-y-4">
          <section className="panel-glass card p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="title-lg">{tt("updates.title")}</h2>
                <p className="muted mt-1">{tt("updates.subtitle")}</p>
              </div>
              <Link className="btn btn-secondary" href="/updates">
                {tt("onboarding.updates")}
              </Link>
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
            <h2 className="title-lg">{tt("settings.appearanceTitle")}</h2>
            <p className="muted mt-1">{tt("settings.appearanceSubtitle")}</p>
            <div className="mt-4">
              <ThemeSelector />
            </div>
          </section>

          <section className="panel-glass card p-5 md:p-6">
            <h2 className="title-lg">{tt("settings.calendarLayoutTitle")}</h2>
            <p className="muted mt-1">{tt("settings.calendarLayoutSubtitle")}</p>
            <div className="mt-4">
              <CalendarLayoutSelector />
            </div>
          </section>

          <section className="panel-glass card p-5 md:p-6">
            <h2 className="title-lg">{tt("pwa.title")}</h2>
            <p className="muted mt-1">{tt("pwa.subtitle")}</p>
            <PwaInstall />
          </section>

          <section className="panel-glass card p-5 md:p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="text-accent" size={17} />
              <h2 className="title-lg">{tt("settings.sessionTitle")}</h2>
            </div>
            <p className="muted mt-1">{tt("settings.sessionSubtitle")}</p>
            <dl className="mt-4 grid gap-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <dt className="font-medium text-text">{tt("settings.sessionCurrentLogin")}</dt>
                <dd className="text-muted">
                  <LocalizedDateTime emptyText={tt("settings.sessionNoLoginHistory")} iso={sessionLogins.lastLoginAt} />
                </dd>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <dt className="font-medium text-text">{tt("settings.sessionPreviousLogin")}</dt>
                <dd className="text-muted">
                  <LocalizedDateTime emptyText={tt("settings.sessionNoLoginHistory")} iso={sessionLogins.prevLoginAt} />
                </dd>
              </div>
            </dl>
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
      </div>
    </div>
  );
}
