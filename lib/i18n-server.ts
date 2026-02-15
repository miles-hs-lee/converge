import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from "@/lib/i18n";

const LOCALE_COOKIE = "converge_locale";

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (cookieLocale) {
    return normalizeLocale(cookieLocale);
  }

  // Fall back to user preference saved in DB (cross-device).
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return DEFAULT_LOCALE;
  }

  const { data } = await supabase.from("app_users").select("locale").eq("id", user.id).maybeSingle();
  return normalizeLocale(data?.locale ?? DEFAULT_LOCALE);
}

export { LOCALE_COOKIE };

