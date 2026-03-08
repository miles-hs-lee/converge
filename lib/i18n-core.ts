export const SUPPORTED_LOCALES = ["ko-KR", "en-US", "ja-JP"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ko-KR";

export type I18nVars = Record<string, string | number>;

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  if (!value) return false;
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function normalizeLocale(value: string | null | undefined): Locale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

export function htmlLang(locale: Locale): "ko" | "en" | "ja" {
  if (locale.startsWith("en")) return "en";
  if (locale.startsWith("ja")) return "ja";
  return "ko";
}

export function intlLocale(locale: Locale): string {
  return locale;
}

export function formatI18nTemplate(template: string, vars?: I18nVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, varName: string) => {
    const val = vars[varName];
    return val === undefined || val === null ? match : String(val);
  });
}
