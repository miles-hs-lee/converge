"use client";

import { isBlockedAnalyticsEventName, type AnalyticsEventName } from "@/lib/analytics/events";

type AnalyticsProperties = Record<string, unknown>;
type CaptureResponse = { ok?: boolean; skipped?: boolean };

const DISTINCT_ID_STORAGE_KEY = "converge:analytics:distinct_id";
const INGEST_ENDPOINT = "/api/ingest";
const LEGACY_CAPTURE_ENDPOINT = "/api/analytics/capture";

function createAnonymousDistinctId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `anon-${crypto.randomUUID()}`;
  }
  return `anon-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function isDebugAnalyticsEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const search = window.location.search ?? "";
  return search.includes("debugAnalytics=1");
}

async function postEventToEndpoint(endpoint: string, body: string): Promise<boolean> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
    keepalive: true,
    credentials: "same-origin"
  });

  let payload: CaptureResponse | null = null;
  try {
    payload = (await response.json()) as CaptureResponse;
  } catch {
    payload = null;
  }

  const ok = response.ok && (payload?.ok === true || payload?.skipped === true);
  if (isDebugAnalyticsEnabled()) {
    console.info("[ConvergeAnalytics]", { endpoint, status: response.status, payload, ok });
  }
  return ok;
}

function getStoredDistinctId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  try {
    const existing = window.localStorage.getItem(DISTINCT_ID_STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const next = createAnonymousDistinctId();
    window.localStorage.setItem(DISTINCT_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return createAnonymousDistinctId();
  }
}

export function setClientAnalyticsIdentity(userId: string | null | undefined): string {
  if (typeof window === "undefined") {
    return userId ?? "server";
  }

  const nextId = userId && userId.trim().length > 0 ? userId.trim() : getStoredDistinctId();
  try {
    window.localStorage.setItem(DISTINCT_ID_STORAGE_KEY, nextId);
  } catch {
    // ignore storage failures and keep runtime fallback.
  }
  return nextId;
}

export async function trackClientEvent(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
  options?: { distinctId?: string }
): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  if (isBlockedAnalyticsEventName(event)) {
    return;
  }

  const distinctId = options?.distinctId ?? getStoredDistinctId();
  const payload = {
    event,
    distinctId,
    properties: {
      path: window.location.pathname,
      locale: navigator.language,
      ...properties
    }
  };
  const body = JSON.stringify(payload);

  try {
    const first = await postEventToEndpoint(INGEST_ENDPOINT, body);
    if (isDebugAnalyticsEnabled()) {
      console.info("[ConvergeAnalytics]", { event, endpoint: INGEST_ENDPOINT, success: first });
    }
    if (first) {
      return;
    }

    // Legacy endpoint fallback in case network filters block one path.
    const second = await postEventToEndpoint(LEGACY_CAPTURE_ENDPOINT, body);
    if (isDebugAnalyticsEnabled()) {
      console.info("[ConvergeAnalytics]", { event, endpoint: LEGACY_CAPTURE_ENDPOINT, success: second });
    }
    if (second) {
      return;
    }

    throw new Error("analytics_capture_failed");
  } catch {
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([body], { type: "application/json" });
        const primary = navigator.sendBeacon(INGEST_ENDPOINT, blob);
        const secondary = navigator.sendBeacon(LEGACY_CAPTURE_ENDPOINT, blob);
        if (isDebugAnalyticsEnabled()) {
          console.info("[ConvergeAnalytics]", { endpoint: "beacon", primary, secondary });
        }
      }
    } catch {
      // ignore analytics transport failures
    }
  }
}
