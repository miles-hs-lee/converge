"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE } from "@/lib/i18n-server";
import { normalizeLocale, type Locale } from "@/lib/i18n";
import { syncUserConnections, type SyncMode, type SyncSummary } from "@/lib/connection-sync";

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

  let result: SyncSummary;
  try {
    result = await syncUserConnections({ userId: user.id, mode });
  } catch {
    redirect("/settings?status=manual_sync_failed");
  }

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
    .select("id");

  if (error || !data || data.length === 0) {
    redirect("/settings?status=connection_delete_failed");
  }

  redirect("/settings?status=connection_deleted");
}
