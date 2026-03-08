type StandardTagKey = "route" | "provider" | "sync_mode" | "account_count_bucket" | "locale";

export type StandardSentryTagInput = {
  route?: unknown;
  provider?: unknown;
  syncMode?: unknown;
  accountCount?: unknown;
  accountCountBucket?: unknown;
  locale?: unknown;
};

export const STANDARD_SENTRY_TAG_KEYS: readonly StandardTagKey[] = [
  "route",
  "provider",
  "sync_mode",
  "account_count_bucket",
  "locale"
];

function normalizeTagString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function sanitizeRoutePath(value: string): string {
  if (!value) {
    return "unknown";
  }

  const sanitized = value.split("#")[0]?.split("?")[0]?.trim() ?? "";
  if (!sanitized) {
    return "unknown";
  }
  if (sanitized.startsWith("/")) {
    return sanitized;
  }

  try {
    const parsed = new URL(sanitized);
    return parsed.pathname || "unknown";
  } catch {
    return "unknown";
  }
}

function normalizeProvider(value: unknown): string {
  const normalized = normalizeTagString(value)?.toLowerCase() ?? "";
  if (!normalized) {
    return "unknown";
  }
  if (normalized.includes("microsoft") || normalized.includes("azure") || normalized === "ms") {
    return "microsoft";
  }
  if (normalized.includes("google")) {
    return "google";
  }
  if (normalized.includes("mixed")) {
    return "mixed";
  }
  return "unknown";
}

function normalizeSyncMode(value: unknown): string {
  const normalized = normalizeTagString(value)?.toLowerCase() ?? "";
  if (normalized === "calendar" || normalized === "people" || normalized === "all") {
    return normalized;
  }
  return "unknown";
}

function normalizeLocaleTag(value: unknown): string {
  const normalized = normalizeTagString(value)?.toLowerCase() ?? "";
  if (!normalized) {
    return "unknown";
  }
  if (normalized.startsWith("ko")) {
    return "ko-KR";
  }
  if (normalized.startsWith("en")) {
    return "en-US";
  }
  if (normalized.startsWith("ja")) {
    return "ja-JP";
  }
  return "unknown";
}

function parseAccountCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function accountCountBucket(value: unknown): string {
  const count = parseAccountCount(value);
  if (count === null || count < 0) {
    return "unknown";
  }
  if (count <= 0) {
    return "0";
  }
  if (count <= 1) {
    return "1";
  }
  if (count <= 3) {
    return "2-3";
  }
  if (count <= 5) {
    return "4-5";
  }
  if (count <= 10) {
    return "6-10";
  }
  return "11+";
}

export function buildStandardSentryTags(input: StandardSentryTagInput): Record<StandardTagKey, string> {
  const normalizedRoute = sanitizeRoutePath(normalizeTagString(input.route) ?? "");
  const normalizedProvider = normalizeProvider(input.provider);
  const normalizedSyncMode = normalizeSyncMode(input.syncMode);
  const normalizedLocale = normalizeLocaleTag(input.locale);
  const normalizedAccountBucket = normalizeTagString(input.accountCountBucket) ?? accountCountBucket(input.accountCount);

  return {
    route: normalizedRoute,
    provider: normalizedProvider,
    sync_mode: normalizedSyncMode,
    account_count_bucket: normalizedAccountBucket,
    locale: normalizedLocale
  };
}

export function applyStandardSentryScopeTags(
  scope: { setTag: (key: string, value: string) => void },
  input: StandardSentryTagInput
): Record<StandardTagKey, string> {
  const tags = buildStandardSentryTags(input);
  STANDARD_SENTRY_TAG_KEYS.forEach((key) => {
    scope.setTag(key, tags[key]);
  });
  return tags;
}
