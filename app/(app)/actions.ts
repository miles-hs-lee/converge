"use server";

import * as Sentry from "@sentry/nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE } from "@/lib/i18n-server";
import { normalizeLocale, type Locale } from "@/lib/i18n";
import { syncUserConnections, type SyncMode, type SyncSummary } from "@/lib/connection-sync";
import { consumeRateLimit } from "@/lib/rate-limit";
import { analyticsEvents } from "@/lib/analytics/events";
import { captureServerEvent } from "@/lib/analytics/server";
import { applyStandardSentryScopeTags } from "@/lib/observability/sentry-tags";

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login?status=signed_out");
}

export async function setLocaleAction(nextLocale: Locale): Promise<void> {
  const locale = normalizeLocale(nextLocale);
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return;
  }

  // Persist to DB for cross-device preference. RLS allows users to upsert their own row.
  await supabase
    .from("app_users")
    .upsert({ id: user.id, email: user.email, locale }, { onConflict: "id" });
}

function normalizeSyncMode(value: FormDataEntryValue | null): SyncMode {
  if (value === "calendar" || value === "people" || value === "all") {
    return value;
  }
  return "all";
}

export async function manualSyncAction(formData: FormData): Promise<void> {
  const mode = normalizeSyncMode(formData.get("mode"));
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?status=auth_required");
  }

  await captureServerEvent({
    event: analyticsEvents.manualSyncStarted,
    distinctId: user.id,
    properties: { mode }
  });

  const allowed = await consumeRateLimit({
    scope: "manual_sync",
    actor: `${user.id}:${mode}`,
    limit: 2,
    windowSeconds: 60
  });
  if (!allowed) {
    redirect("/settings?status=manual_sync_rate_limited");
  }

  let result: SyncSummary;
  try {
    result = await syncUserConnections({ userId: user.id, mode });
  } catch (error) {
    Sentry.withScope((scope) => {
      applyStandardSentryScopeTags(scope, {
        route: "/settings",
        provider: "mixed",
        syncMode: mode
      });
      scope.setUser({ id: user.id });
      Sentry.captureException(error);
    });
    await captureServerEvent({
      event: analyticsEvents.manualSyncCompleted,
      distinctId: user.id,
      properties: { mode, ok: false, failures: 1, reason: "sync_error" }
    });
    redirect("/settings?status=manual_sync_failed");
  }

  await captureServerEvent({
    event: analyticsEvents.manualSyncCompleted,
    distinctId: user.id,
    properties: {
      mode,
      ok: result.failures === 0,
      failures: result.failures,
      connectionsScanned: result.connectionsScanned,
      calendarSynced: result.calendarSynced,
      peopleSynced: result.peopleSynced,
      partials: result.partials
    }
  });

  if (result.failures > 0) {
    redirect("/settings?status=manual_sync_partial");
  }
  redirect("/settings?status=manual_sync_done");
}

export async function deleteConnectionAction(formData: FormData): Promise<void> {
  const rawConnectionId = formData.get("connectionId");
  if (typeof rawConnectionId !== "string" || rawConnectionId.trim().length === 0) {
    redirect("/settings?status=connection_delete_failed");
  }

  const connectionId = rawConnectionId.trim();
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?status=auth_required");
  }

  const { data, error } = await supabase
    .from("m365_connections")
    .delete()
    .eq("id", connectionId)
    .eq("user_id", user.id)
    .select("id,provider");

  if (error || !data || data.length === 0) {
    redirect("/settings?status=connection_delete_failed");
  }

  await captureServerEvent({
    event: analyticsEvents.connectionDeleted,
    distinctId: user.id,
    properties: {
      connectionId,
      provider: data[0]?.provider ?? "unknown"
    }
  });

  redirect("/settings?status=connection_deleted");
}
