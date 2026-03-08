import { cookies, headers } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from "@/lib/i18n";
import { getRscSupabase, getRscUser } from "@/lib/server/request-context";

const LOCALE_COOKIE = "converge_locale";

function localeFromLanguageTag(value: string | null | undefined): Locale | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith("ko")) return "ko-KR";
  if (normalized.startsWith("en")) return "en-US";
  if (normalized.startsWith("ja")) return "ja-JP";
  return null;
}

function localeFromAcceptLanguageHeader(value: string | null): Locale | null {
  if (!value) {
    return null;
  }
  const tokens = value
    .split(",")
    .map((token) => token.split(";")[0]?.trim() ?? "")
    .filter(Boolean);

  for (const token of tokens) {
    const locale = localeFromLanguageTag(token);
    if (locale) {
      return locale;
    }
  }
  return null;
}

const readCookieLocale = cache(async (): Promise<Locale | null> => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (!cookieLocale) {
    return null;
  }
  return localeFromLanguageTag(cookieLocale) ?? normalizeLocale(cookieLocale);
});

const readHeaderLocale = cache(async (): Promise<Locale | null> => {
  const headerStore = await headers();
  return localeFromAcceptLanguageHeader(headerStore.get("accept-language"));
});

const readDbLocale = cache(async (): Promise<Locale | null> => {
  const user = await getRscUser();
  if (!user) {
    return null;
  }

  const supabase = await getRscSupabase();
  const { data } = await supabase.from("app_users").select("locale").eq("id", user.id).maybeSingle();
  return localeFromLanguageTag(data?.locale) ?? normalizeLocale(data?.locale ?? DEFAULT_LOCALE);
});

export async function getLocaleFromCookieOnly(): Promise<Locale> {
  return (await readCookieLocale()) ?? (await readHeaderLocale()) ?? DEFAULT_LOCALE;
}

export async function getServerLocale(options?: { dbFallback?: boolean }): Promise<Locale> {
  const cookieLocale = await readCookieLocale();
  if (cookieLocale) {
    return cookieLocale;
  }

  if (options?.dbFallback) {
    const dbLocale = await readDbLocale();
    if (dbLocale) {
      return dbLocale;
    }
  }

  return (await readHeaderLocale()) ?? DEFAULT_LOCALE;
}

export { LOCALE_COOKIE };
