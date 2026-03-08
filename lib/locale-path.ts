import type { Locale } from "@/lib/i18n";

export const LOCALE_SEGMENTS = ["ko", "en", "ja"] as const;
export type LocaleSegment = (typeof LOCALE_SEGMENTS)[number];

const SEGMENT_TO_LOCALE: Record<LocaleSegment, Locale> = {
  ko: "ko-KR",
  en: "en-US",
  ja: "ja-JP"
};

const LOCALE_TO_SEGMENT = new Map<Locale, LocaleSegment>([
  ["ko-KR", "ko"],
  ["en-US", "en"],
  ["ja-JP", "ja"]
]);

export function localeFromSegment(segment: string | null | undefined): Locale {
  if (!segment) {
    return "ko-KR";
  }
  const normalized = segment.trim().toLowerCase();
  if (normalized === "en") return "en-US";
  if (normalized === "ja") return "ja-JP";
  return "ko-KR";
}

export function localeToSegment(locale: Locale): LocaleSegment {
  return LOCALE_TO_SEGMENT.get(locale) ?? "ko";
}

export function localeSegmentParams(): Array<{ locale: LocaleSegment }> {
  return LOCALE_SEGMENTS.map((locale) => ({ locale }));
}

export { SEGMENT_TO_LOCALE };
