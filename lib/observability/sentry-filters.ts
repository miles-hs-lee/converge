import { buildStandardSentryTags } from "@/lib/observability/sentry-tags";

type AnyRecord = Record<string, unknown>;

const NOISE_PATTERNS = [
  "inpage.js",
  "lockdown-install.js",
  "chrome-extension://",
  "moz-extension://",
  "safari-extension://",
  "sentry-uit.line-apps.com",
  "ses removing unpermitted intrinsics",
  "signal is aborted without reason"
];

const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|authorization|cookie|set-cookie|apikey|api_key|client_secret|mail|email|phone|mobile|upn|user_principal_name|subject|location|attendee|organizer|description|body_preview|address|employeeid|employee_id|display_name)/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /\+?\d[\d().\-\s]{6,}\d/g;
const BEARER_PATTERN = /\bbearer\s+[a-z0-9._~+/=-]+\b/gi;

function toRecord(value: unknown): AnyRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as AnyRecord;
}

function normalizeTagString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parseNumeric(value: unknown): number | null {
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

function stableHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function maskedToken(kind: string, value: string): string {
  return `[redacted:${kind}:${stableHash(value.toLowerCase())}]`;
}

function sanitizeText(value: string): string {
  if (!value) {
    return value;
  }
  return value
    .replace(EMAIL_PATTERN, (match) => maskedToken("email", match))
    .replace(PHONE_PATTERN, (match) => maskedToken("phone", match))
    .replace(BEARER_PATTERN, "[redacted:bearer]");
}

function sanitizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    const path = trimmed.split("#")[0]?.split("?")[0] ?? "";
    return sanitizeText(path);
  }

  try {
    const parsed = new URL(trimmed);
    return sanitizeText(`${parsed.origin}${parsed.pathname}`);
  } catch {
    const withoutQuery = trimmed.split("#")[0]?.split("?")[0] ?? trimmed;
    return sanitizeText(withoutQuery);
  }
}

function redactSensitiveValue(value: unknown): unknown {
  if (typeof value === "string") {
    return maskedToken("field", value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return "[Filtered]";
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValue(item));
  }
  const nested = toRecord(value);
  if (nested) {
    return "[Filtered]";
  }
  return "[Filtered]";
}

function collectEventText(event: AnyRecord): string {
  const parts: string[] = [];

  const message = event.message;
  if (typeof message === "string") {
    parts.push(message);
  }

  const exception = toRecord(event.exception);
  const values = exception?.values;
  if (Array.isArray(values)) {
    for (const item of values) {
      const itemRecord = toRecord(item);
      const value = itemRecord?.value;
      if (typeof value === "string") {
        parts.push(value);
      }

      const stacktrace = toRecord(itemRecord?.stacktrace);
      const frames = stacktrace?.frames;
      if (Array.isArray(frames)) {
        for (const frame of frames) {
          const frameRecord = toRecord(frame);
          const filename = frameRecord?.filename;
          if (typeof filename === "string") {
            parts.push(filename);
          }
        }
      }
    }
  }

  const request = toRecord(event.request);
  const url = request?.url;
  if (typeof url === "string") {
    parts.push(url);
  }

  return parts.join(" ").toLowerCase();
}

function redactRecord(record: AnyRecord, depth = 0) {
  if (depth > 6) {
    return;
  }

  for (const key of Object.keys(record)) {
    const value = record[key];
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      record[key] = redactSensitiveValue(value);
      continue;
    }
    if (typeof value === "string") {
      if (key.toLowerCase().includes("url")) {
        record[key] = sanitizeUrl(value);
      } else {
        record[key] = sanitizeText(value);
      }
      continue;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "string") {
          value[index] = sanitizeText(item);
          return;
        }
        const itemRecord = toRecord(item);
        if (itemRecord) {
          redactRecord(itemRecord, depth + 1);
        }
      });
      continue;
    }
    const nested = toRecord(value);
    if (nested) {
      redactRecord(nested, depth + 1);
    }
  }
}

export function shouldDropSentryEvent(event: unknown): boolean {
  const record = toRecord(event);
  if (!record) {
    return false;
  }
  const text = collectEventText(record);
  return NOISE_PATTERNS.some((pattern) => text.includes(pattern));
}

function inferProviderFromRoute(route: string | undefined): string | undefined {
  if (!route) {
    return undefined;
  }
  const normalized = route.toLowerCase();
  if (normalized.includes("google")) {
    return "google";
  }
  if (normalized.includes("microsoft") || normalized.includes("azure")) {
    return "microsoft";
  }
  return undefined;
}

function inferSyncModeFromRoute(route: string | undefined): string | undefined {
  if (!route) {
    return undefined;
  }
  const normalized = route.toLowerCase();
  if (normalized.includes("sync-calendar") || normalized.includes("calendar/entry-sync") || normalized.includes("/calendar")) {
    return "calendar";
  }
  if (normalized.includes("sync-people") || normalized.includes("/people")) {
    return "people";
  }
  return undefined;
}

function parseLocaleFromAcceptLanguage(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const first = value
    .split(",")
    .map((token) => token.split(";")[0]?.trim() ?? "")
    .find(Boolean);
  return first || undefined;
}

function ensureStandardTags(record: AnyRecord) {
  const tags = toRecord(record.tags) ?? {};
  const request = toRecord(record.request);
  const requestHeaders = toRecord(request?.headers);

  const routeCandidate =
    normalizeTagString(tags.route) ??
    normalizeTagString(record.transaction) ??
    normalizeTagString(request?.url);
  const providerCandidate =
    normalizeTagString(tags.provider) ??
    normalizeTagString(tags.identity_provider) ??
    inferProviderFromRoute(routeCandidate);
  const syncModeCandidate =
    normalizeTagString(tags.sync_mode) ??
    normalizeTagString(tags.mode) ??
    inferSyncModeFromRoute(routeCandidate);
  const localeCandidate =
    normalizeTagString(tags.locale) ??
    parseLocaleFromAcceptLanguage(requestHeaders?.["accept-language"]) ??
    parseLocaleFromAcceptLanguage(requestHeaders?.["Accept-Language"]);
  const accountCount =
    parseNumeric(tags.account_count) ??
    parseNumeric(tags.connection_count) ??
    parseNumeric(tags.connections_scanned) ??
    parseNumeric(toRecord(record.extra)?.accountCount) ??
    parseNumeric(toRecord(record.extra)?.connectionsScanned);

  record.tags = {
    ...tags,
    ...buildStandardSentryTags({
      route: routeCandidate,
      provider: providerCandidate,
      syncMode: syncModeCandidate,
      locale: localeCandidate,
      accountCount,
      accountCountBucket: normalizeTagString(tags.account_count_bucket)
    })
  };
}

export function sanitizeSentryEvent<T>(event: T): T {
  const record = toRecord(event);
  if (!record) {
    return event;
  }

  const user = toRecord(record.user);
  if (user) {
    // Keep only stable ID-like value. Remove direct PII.
    const id = typeof user.id === "string" ? user.id : undefined;
    record.user = id ? { id } : undefined;
  }

  const request = toRecord(record.request);
  if (request) {
    if (typeof request.url === "string") {
      request.url = sanitizeUrl(request.url);
    }
    const headers = toRecord(request.headers);
    if (headers) {
      redactRecord(headers);
    }
    const data = request.data;
    const dataRecord = toRecord(data);
    if (dataRecord) {
      redactRecord(dataRecord);
    } else if (typeof data === "string" && data.length > 512) {
      request.data = `${sanitizeText(data.slice(0, 512))}...[truncated]`;
    } else if (typeof data === "string") {
      request.data = sanitizeText(data);
    }
  }

  const contexts = toRecord(record.contexts);
  if (contexts) {
    redactRecord(contexts);
  }

  const extra = toRecord(record.extra);
  if (extra) {
    redactRecord(extra);
  }

  const tags = toRecord(record.tags);
  if (tags) {
    redactRecord(tags);
  }

  if (typeof record.message === "string") {
    record.message = sanitizeText(record.message);
  }

  ensureStandardTags(record);

  return record as T;
}

export function parseSampleRate(raw: string | undefined, fallback: number): number {
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed < 0) {
    return 0;
  }
  if (parsed > 1) {
    return 1;
  }
  return parsed;
}
