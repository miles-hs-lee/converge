import { serverEnv } from "@/lib/env/server";
import { isBlockedAnalyticsEventName, type AnalyticsEventName } from "@/lib/analytics/events";

type AnalyticsProperties = Record<string, unknown>;

type ServerCaptureInput = {
  event: AnalyticsEventName;
  distinctId: string;
  properties?: AnalyticsProperties;
  timestamp?: string;
};

function normalizePosthogHost(rawHost: string | undefined): string {
  if (!rawHost) {
    return "https://us.i.posthog.com";
  }
  const trimmed = rawHost.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return "https://us.i.posthog.com";
  }
  return trimmed;
}

function withTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timer);
    },
    { once: true }
  );
  return controller.signal;
}

async function postCapture(endpoint: string, body: unknown, timeoutMs: number): Promise<boolean> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: withTimeoutSignal(timeoutMs)
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return false;
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      // Fallback: some proxies may strip JSON body; treat HTTP 2xx as success.
      return true;
    }

    const record = payload as Record<string, unknown>;
    const status = typeof record.status === "string" ? record.status.toLowerCase() : "";
    const error = typeof record.error === "string" ? record.error : "";
    const detail = typeof record.detail === "string" ? record.detail : "";

    if (error || detail) {
      return false;
    }
    if (status && status !== "ok") {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function isAnalyticsConfigured(): boolean {
  return Boolean(serverEnv.posthogApiKey);
}

export async function captureServerEvent(input: ServerCaptureInput): Promise<boolean> {
  if (!serverEnv.posthogApiKey) {
    return false;
  }
  if (isBlockedAnalyticsEventName(input.event)) {
    return false;
  }

  const endpoint = `${normalizePosthogHost(serverEnv.posthogHost)}/capture/`;
  const body: Record<string, unknown> = {
    api_key: serverEnv.posthogApiKey,
    event: input.event,
    distinct_id: input.distinctId,
    properties: {
      ...input.properties
    }
  };
  if (input.timestamp) {
    body.timestamp = input.timestamp;
  }

  // Network jitter to PostHog can exceed 1.5s on serverless cold paths.
  // Use a longer timeout and one retry to reduce event loss.
  const firstTry = await postCapture(endpoint, body, 5000);
  if (firstTry) {
    return true;
  }
  return postCapture(endpoint, body, 5000);
}
