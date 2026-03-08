import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/server";
import { getMicrosoftScopeString, requiredMicrosoftGraphScopes } from "@/lib/microsoft";
import { syncMicrosoftCalendarSnapshot, syncMicrosoftPeopleSnapshot } from "@/lib/microsoft-sync";
import { syncGoogleCalendarSnapshot } from "@/lib/google-sync";
import { accountCountBucket } from "@/lib/observability/sentry-tags";
import {
  getOAuthConnectionSecrets,
  isSecretEncrypted,
  upsertOAuthConnectionSecret,
  type OAuthConnectionSecretRow
} from "@/lib/oauth-connection-secrets";

export type SyncMode = "calendar" | "people" | "all";

type ConnectionRow = {
  id: string;
  user_id: string;
  provider: string;
  m365_user_principal_name: string | null;
  token_expires_at: string;
  scopes: string[] | null;
  sync_state: Record<string, unknown> | null;
};

type SyncResult = {
  ok: boolean;
  partial: boolean;
  syncedCount: number;
  statePatch?: Record<string, unknown>;
};

export type SyncSummary = {
  usersScanned: number;
  connectionsScanned: number;
  calendarSynced: number;
  peopleSynced: number;
  failures: number;
  partials: number;
  skipped: number;
};

function emptySummary(): SyncSummary {
  return {
    usersScanned: 0,
    connectionsScanned: 0,
    calendarSynced: 0,
    peopleSynced: 0,
    failures: 0,
    partials: 0,
    skipped: 0
  };
}

function mergeSummary(target: SyncSummary, source: SyncSummary) {
  target.usersScanned += source.usersScanned;
  target.connectionsScanned += source.connectionsScanned;
  target.calendarSynced += source.calendarSynced;
  target.peopleSynced += source.peopleSynced;
  target.failures += source.failures;
  target.partials += source.partials;
  target.skipped += source.skipped;
}

function parsePositiveIntInRange(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = raw ? Number(raw) : fallback;
  if (!Number.isFinite(n)) {
    return fallback;
  }
  const rounded = Math.floor(n);
  if (rounded < min || rounded > max) {
    return fallback;
  }
  return rounded;
}

function resolveConnectionSyncConcurrency(): number {
  return parsePositiveIntInRange(process.env.SYNC_CONNECTION_CONCURRENCY, 2, 1, 6);
}

function resolveUserSyncConcurrency(): number {
  return parsePositiveIntInRange(process.env.SYNC_USER_CONCURRENCY, 2, 1, 4);
}

async function runWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.floor(concurrency));
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function next(): Promise<void> {
    const index = cursor;
    if (index >= items.length) {
      return;
    }
    cursor += 1;
    results[index] = await worker(items[index]!);
    await next();
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(workers);
  return results;
}

function parseSyncState(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as Record<string, unknown>;
}

function readSyncedAt(raw: unknown): number | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const syncedAt = (raw as Record<string, unknown>).syncedAt;
  if (typeof syncedAt !== "string") {
    return null;
  }
  const parsed = Date.parse(syncedAt);
  return Number.isFinite(parsed) ? parsed : null;
}

function shouldRunByStaleness(params: { state: Record<string, unknown>; key: "calendar" | "people"; staleMs?: number }): boolean {
  const { state, key, staleMs } = params;
  if (!staleMs || staleMs <= 0) {
    return true;
  }

  const section = state[key];
  const syncedAt = readSyncedAt(section);
  if (!syncedAt) {
    return true;
  }
  return Date.now() - syncedAt >= staleMs;
}

function tokenStillValid(tokenExpiresAt: string): boolean {
  const expiresAt = Date.parse(tokenExpiresAt);
  if (!Number.isFinite(expiresAt)) {
    return false;
  }
  return expiresAt > Date.now() + 1000 * 60;
}

async function refreshMicrosoftAccessToken(params: {
  admin: ReturnType<typeof createAdminClient>;
  connection: ConnectionRow;
  secret: OAuthConnectionSecretRow;
}): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  const { admin, connection, secret } = params;
  const mergedScopes = new Set<string>(connection.scopes?.length ? connection.scopes : getMicrosoftScopeString().split(" "));
  requiredMicrosoftGraphScopes.forEach((scope) => mergedScopes.add(scope));
  const scope = [...mergedScopes].join(" ");

  const response = await fetch(`https://login.microsoftonline.com/${serverEnv.azureTenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: serverEnv.azureClientId,
      client_secret: serverEnv.azureClientSecret,
      grant_type: "refresh_token",
      refresh_token: secret.refresh_token_enc,
      scope
    })
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, error: `ms_refresh_failed:${text.slice(0, 160)}` };
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!payload.access_token) {
    return { ok: false, error: "ms_refresh_payload_invalid" };
  }

  const expiresIn = Number(payload.expires_in || 3600);
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const scopes = (payload.scope ?? "").split(" ").filter(Boolean);
  const refreshedAccessToken = payload.access_token;
  const refreshedRefreshToken = payload.refresh_token ?? secret.refresh_token_enc;
  const nowIso = new Date().toISOString();

  const [connectionUpdate, secretStored] = await Promise.all([
    admin
    .from("m365_connections")
    .update({
      token_expires_at: tokenExpiresAt,
      scopes: scopes.length > 0 ? scopes : connection.scopes ?? [],
      status: "active",
      updated_at: nowIso
    })
    .eq("id", connection.id),
    upsertOAuthConnectionSecret({
      connectionId: connection.id,
      accessToken: refreshedAccessToken,
      refreshToken: refreshedRefreshToken,
      adminClient: admin
    })
  ]);

  if (connectionUpdate.error || !secretStored) {
    return { ok: false, error: "ms_refresh_persist_failed" };
  }

  connection.token_expires_at = tokenExpiresAt;
  connection.scopes = scopes.length > 0 ? scopes : connection.scopes;
  secret.access_token_enc = refreshedAccessToken;
  secret.refresh_token_enc = refreshedRefreshToken;

  return { ok: true, accessToken: refreshedAccessToken };
}

async function refreshGoogleAccessToken(params: {
  admin: ReturnType<typeof createAdminClient>;
  connection: ConnectionRow;
  secret: OAuthConnectionSecretRow;
}): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  const { admin, connection, secret } = params;
  if (!serverEnv.googleClientId || !serverEnv.googleClientSecret) {
    return { ok: false, error: "google_env_missing" };
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: serverEnv.googleClientId,
      client_secret: serverEnv.googleClientSecret,
      grant_type: "refresh_token",
      refresh_token: secret.refresh_token_enc
    })
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, error: `google_refresh_failed:${text.slice(0, 160)}` };
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!payload.access_token) {
    return { ok: false, error: "google_refresh_payload_invalid" };
  }

  const expiresIn = Number(payload.expires_in || 3600);
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const scopes = (payload.scope ?? "").split(" ").filter(Boolean);
  const refreshedAccessToken = payload.access_token;
  const nowIso = new Date().toISOString();

  const [connectionUpdate, secretStored] = await Promise.all([
    admin
    .from("m365_connections")
    .update({
      token_expires_at: tokenExpiresAt,
      scopes: scopes.length > 0 ? scopes : connection.scopes ?? [],
      status: "active",
      updated_at: nowIso
    })
    .eq("id", connection.id),
    upsertOAuthConnectionSecret({
      connectionId: connection.id,
      accessToken: refreshedAccessToken,
      refreshToken: secret.refresh_token_enc,
      adminClient: admin
    })
  ]);

  if (connectionUpdate.error || !secretStored) {
    return { ok: false, error: "google_refresh_persist_failed" };
  }

  connection.token_expires_at = tokenExpiresAt;
  connection.scopes = scopes.length > 0 ? scopes : connection.scopes;
  secret.access_token_enc = refreshedAccessToken;

  return { ok: true, accessToken: refreshedAccessToken };
}

async function ensureAccessToken(params: {
  admin: ReturnType<typeof createAdminClient>;
  connection: ConnectionRow;
  secret: OAuthConnectionSecretRow | null;
}): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  const { admin, connection, secret } = params;

  if (!secret?.refresh_token_enc) {
    return { ok: false, error: "reauth_required:missing_secret" };
  }

  if (tokenStillValid(connection.token_expires_at) && secret.access_token_enc) {
    if (!isSecretEncrypted(secret.access_token_enc) || !isSecretEncrypted(secret.refresh_token_enc)) {
      await upsertOAuthConnectionSecret({
        connectionId: connection.id,
        accessToken: secret.access_token_enc,
        refreshToken: secret.refresh_token_enc,
        adminClient: admin
      });
    }
    return { ok: true, accessToken: secret.access_token_enc };
  }

  if (connection.provider === "microsoft") {
    return refreshMicrosoftAccessToken({ admin, connection, secret });
  }
  if (connection.provider === "google") {
    return refreshGoogleAccessToken({ admin, connection, secret });
  }
  return { ok: false, error: `unsupported_provider:${connection.provider}` };
}

async function insertSyncJob(params: {
  userId: string;
  connectionId: string;
  jobType: "calendar" | "people";
  status: "success" | "failed";
  errorMessage?: string;
}) {
  const { userId, connectionId, jobType, status, errorMessage } = params;
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  await admin.from("sync_jobs").insert({
    user_id: userId,
    connection_id: connectionId,
    job_type: jobType,
    status,
    started_at: nowIso,
    finished_at: nowIso,
    error_message: errorMessage ?? null
  });
}

type RunConnectionParams = {
  connection: ConnectionRow;
  connectionSecret: OAuthConnectionSecretRow | null;
  mode: SyncMode;
  calendarStaleMs?: number;
  calendarMaxDeltaPagesPerCalendar?: number;
  peopleStaleMs?: number;
};

async function runConnectionSync(params: RunConnectionParams): Promise<SyncSummary> {
  const { connection, connectionSecret, mode, calendarStaleMs, calendarMaxDeltaPagesPerCalendar, peopleStaleMs } = params;
  const admin = createAdminClient();
  const summary = emptySummary();
  summary.connectionsScanned = 1;

  const syncState = parseSyncState(connection.sync_state);
  let runCalendar = mode === "calendar" || mode === "all";
  let runPeople = mode === "people" || mode === "all";

  if (runCalendar && !shouldRunByStaleness({ state: syncState, key: "calendar", staleMs: calendarStaleMs })) {
    runCalendar = false;
    summary.skipped += 1;
  }
  if (runPeople && !shouldRunByStaleness({ state: syncState, key: "people", staleMs: peopleStaleMs })) {
    runPeople = false;
    summary.skipped += 1;
  }

  if (!runCalendar && !runPeople) {
    return summary;
  }

  const token = await ensureAccessToken({ admin, connection, secret: connectionSecret });
  if (!token.ok) {
    if (token.error.startsWith("reauth_required:")) {
      const nowIso = new Date().toISOString();
      await admin
        .from("m365_connections")
        .update({
          status: "revoked",
          sync_state: {
            ...syncState,
            security: {
              reauthRequired: true,
              reason: token.error,
              at: nowIso
            }
          },
          updated_at: nowIso
        })
        .eq("id", connection.id);
    }

    summary.failures += 1;
    if (runCalendar) {
      await insertSyncJob({
        userId: connection.user_id,
        connectionId: connection.id,
        jobType: "calendar",
        status: "failed",
        errorMessage: token.error
      });
    }
    if (runPeople) {
      await insertSyncJob({
        userId: connection.user_id,
        connectionId: connection.id,
        jobType: "people",
        status: "failed",
        errorMessage: token.error
      });
    }
    return summary;
  }

  const nowIso = new Date().toISOString();
  const nextSyncState: Record<string, unknown> = { ...syncState };

  if (runCalendar) {
    const currentCalendarState = parseSyncState(syncState.calendar);
    let calendarResult: SyncResult = { ok: true, partial: false, syncedCount: 0 };
    if (connection.provider === "microsoft") {
      calendarResult = await Sentry.startSpan(
        {
          name: "sync.microsoft.calendar_snapshot",
          op: "converge.sync.calendar",
          attributes: {
            "converge.route": "syncUserConnections",
            "converge.provider": "microsoft",
            "converge.sync_mode": "calendar",
            "converge.account_count_bucket": accountCountBucket(1)
          }
        },
        () =>
          syncMicrosoftCalendarSnapshot({
            accessToken: token.accessToken,
            accountEmail: connection.m365_user_principal_name ?? "unknown@account",
            connectionId: connection.id,
            calendarState: currentCalendarState,
            maxDeltaPagesPerCalendar: calendarMaxDeltaPagesPerCalendar,
            adminClient: admin
          })
      );
    } else if (connection.provider === "google") {
      calendarResult = await Sentry.startSpan(
        {
          name: "sync.google.calendar_snapshot",
          op: "converge.sync.calendar",
          attributes: {
            "converge.route": "syncUserConnections",
            "converge.provider": "google",
            "converge.sync_mode": "calendar",
            "converge.account_count_bucket": accountCountBucket(1)
          }
        },
        () =>
          syncGoogleCalendarSnapshot({
            accessToken: token.accessToken,
            accountEmail: connection.m365_user_principal_name ?? "unknown@account",
            connectionId: connection.id,
            calendarState: currentCalendarState,
            adminClient: admin
          })
      );
    } else {
      calendarResult = { ok: false, partial: false, syncedCount: 0 };
    }

    if (calendarResult.ok) {
      summary.calendarSynced += calendarResult.syncedCount;
      if (calendarResult.partial) {
        summary.partials += 1;
      }
      await insertSyncJob({
        userId: connection.user_id,
        connectionId: connection.id,
        jobType: "calendar",
        status: "success"
      });
    } else {
      summary.failures += 1;
      await insertSyncJob({
        userId: connection.user_id,
        connectionId: connection.id,
        jobType: "calendar",
        status: "failed",
        errorMessage: "calendar_sync_failed"
      });
    }

    nextSyncState.calendar = {
      ...currentCalendarState,
      ...(calendarResult.statePatch ?? {}),
      ok: calendarResult.ok,
      partial: calendarResult.partial,
      syncedCount: calendarResult.syncedCount,
      syncedAt: nowIso
    };
  }

  if (runPeople) {
    let peopleResult: SyncResult = { ok: true, partial: false, syncedCount: 0 };
    if (connection.provider === "microsoft") {
      peopleResult = await Sentry.startSpan(
        {
          name: "sync.microsoft.people_snapshot",
          op: "converge.sync.people",
          attributes: {
            "converge.route": "syncUserConnections",
            "converge.provider": "microsoft",
            "converge.sync_mode": "people",
            "converge.account_count_bucket": accountCountBucket(1)
          }
        },
        () =>
          syncMicrosoftPeopleSnapshot({
            accessToken: token.accessToken,
            connectionId: connection.id,
            adminClient: admin
          })
      );
    } else {
      // Google provider does not expose org directory in this app's scope.
      peopleResult = { ok: true, partial: false, syncedCount: 0 };
      summary.skipped += 1;
    }

    if (peopleResult.ok) {
      summary.peopleSynced += peopleResult.syncedCount;
      if (peopleResult.partial) {
        summary.partials += 1;
      }
      await insertSyncJob({
        userId: connection.user_id,
        connectionId: connection.id,
        jobType: "people",
        status: "success"
      });
    } else {
      summary.failures += 1;
      await insertSyncJob({
        userId: connection.user_id,
        connectionId: connection.id,
        jobType: "people",
        status: "failed",
        errorMessage: "people_sync_failed"
      });
    }

    nextSyncState.people = {
      ok: peopleResult.ok,
      partial: peopleResult.partial,
      syncedCount: peopleResult.syncedCount,
      syncedAt: nowIso
    };
  }

  await admin
    .from("m365_connections")
    .update({
      sync_state: nextSyncState,
      updated_at: nowIso
    })
    .eq("id", connection.id);

  return summary;
}

export async function syncUserConnections(params: {
  userId: string;
  mode: SyncMode;
  connectionId?: string;
  calendarStaleMs?: number;
  calendarMaxDeltaPagesPerCalendar?: number;
  peopleStaleMs?: number;
}): Promise<SyncSummary> {
  const { userId, mode, connectionId, calendarStaleMs, calendarMaxDeltaPagesPerCalendar, peopleStaleMs } = params;
  const admin = createAdminClient();
  const summary = emptySummary();
  summary.usersScanned = 1;

  let query = admin
    .from("m365_connections")
    .select("id,user_id,provider,m365_user_principal_name,token_expires_at,scopes,sync_state")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (connectionId) {
    query = query.eq("id", connectionId);
  }

  const { data: connections, error } = await query;
  if (error || !connections || connections.length === 0) {
    return summary;
  }

  const secretByConnectionId = await getOAuthConnectionSecrets((connections as ConnectionRow[]).map((row) => row.id));
  const perConnection = await runWithConcurrency(connections as ConnectionRow[], resolveConnectionSyncConcurrency(), async (row) => {
    try {
      return await runConnectionSync({
        connection: row,
        connectionSecret: secretByConnectionId.get(row.id) ?? null,
        mode,
        calendarStaleMs,
        calendarMaxDeltaPagesPerCalendar,
        peopleStaleMs
      });
    } catch {
      return {
        usersScanned: 0,
        connectionsScanned: 1,
        calendarSynced: 0,
        peopleSynced: 0,
        failures: 1,
        partials: 0,
        skipped: 0
      } satisfies SyncSummary;
    }
  });
  perConnection.forEach((one) => mergeSummary(summary, one));

  return summary;
}

export async function syncAllUsers(params: {
  mode: SyncMode;
  calendarStaleMs?: number;
  calendarMaxDeltaPagesPerCalendar?: number;
  peopleStaleMs?: number;
  maxUsers?: number;
}): Promise<SyncSummary> {
  const { mode, calendarStaleMs, calendarMaxDeltaPagesPerCalendar, peopleStaleMs, maxUsers = 200 } = params;
  const admin = createAdminClient();
  const summary = emptySummary();

  const { data: userRows, error } = await admin.from("m365_connections").select("user_id").eq("status", "active").limit(5000);
  if (error || !userRows || userRows.length === 0) {
    return summary;
  }

  const uniqueUserIds = Array.from(new Set(userRows.map((row) => row.user_id))).slice(0, maxUsers);
  const perUser = await runWithConcurrency(uniqueUserIds, resolveUserSyncConcurrency(), async (userId) => {
    try {
      return await syncUserConnections({
        userId,
        mode,
        calendarStaleMs,
        calendarMaxDeltaPagesPerCalendar,
        peopleStaleMs
      });
    } catch {
      return {
        usersScanned: 1,
        connectionsScanned: 0,
        calendarSynced: 0,
        peopleSynced: 0,
        failures: 1,
        partials: 0,
        skipped: 0
      } satisfies SyncSummary;
    }
  });
  perUser.forEach((one) => mergeSummary(summary, one));

  return summary;
}
