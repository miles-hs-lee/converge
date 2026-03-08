import { NextRequest, NextResponse } from "next/server";
import { analyticsEventSet, isBlockedAnalyticsEventName, type AnalyticsEventName } from "@/lib/analytics/events";
import { captureServerEvent, isAnalyticsConfigured } from "@/lib/analytics/server";

type CaptureRequestBody = {
  event?: unknown;
  distinctId?: unknown;
  properties?: unknown;
};

function parseProperties(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return raw as Record<string, unknown>;
}

function eventFromUnknown(raw: unknown): AnalyticsEventName | null {
  if (typeof raw !== "string") {
    return null;
  }
  if (isBlockedAnalyticsEventName(raw)) {
    return null;
  }
  return analyticsEventSet.has(raw as AnalyticsEventName) ? (raw as AnalyticsEventName) : null;
}

function resolveDistinctId(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, 200);
}

function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }
  return origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  if (!isAnalyticsConfigured()) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  let payload: CaptureRequestBody;
  try {
    payload = (await request.json()) as CaptureRequestBody;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const event = eventFromUnknown(payload.event);
  const distinctId = resolveDistinctId(payload.distinctId);
  if (!event || !distinctId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const ok = await captureServerEvent({
    event,
    distinctId,
    properties: {
      ...parseProperties(payload.properties),
      userAgent: request.headers.get("user-agent") ?? undefined
    }
  });

  return NextResponse.json({ ok });
}
