"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE } from "@/lib/i18n-server";
import { normalizeLocale, type Locale } from "@/lib/i18n";

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
