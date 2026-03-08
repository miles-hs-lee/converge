import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncUserConnections } from "@/lib/connection-sync";
import { isMockMode } from "@/lib/mock-mode";
import { consumeRateLimit } from "@/lib/rate-limit";
import { analyticsEvents } from "@/lib/analytics/events";
import { captureServerEvent } from "@/lib/analytics/server";
import { applyStandardSentryScopeTags } from "@/lib/observability/sentry-tags";

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = raw ? Number(raw) : fallback;
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return Math.floor(n);
}

function resolveEntrySyncStaleMs(): number {
  const minutes = parsePositiveInt(process.env.CALENDAR_AUTO_SYNC_STALE_MINUTES, 3);
  return minutes * 60 * 1000;
}

function resolveEntrySyncMaxDeltaPages(): number {
  return parsePositiveInt(process.env.CALENDAR_ENTRY_SYNC_MAX_DELTA_PAGES, 40);
}

function parseLocaleHeader(request: Request): string | undefined {
  const raw = request.headers.get("accept-language");
  if (!raw) {
    return undefined;
  }
  return (
    raw
      .split(",")
      .map((token) => token.split(";")[0]?.trim())
      .find((token): token is string => Boolean(token && token.length > 0)) ?? undefined
  );
}

export async function POST(request: Request) {
  if (isMockMode) {
    return NextResponse.json({ ok: true, skipped: "mock_mode" });
  }

  const locale = parseLocaleHeader(request);
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const allowed = await consumeRateLimit({
    scope: "calendar_entry_sync",
    actor: user.id,
    limit: 6,
    windowSeconds: 60
  });
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  try {
    const summary = await Sentry.startSpan(
      {
        name: "calendar.entry_sync",
        op: "converge.sync.calendar",
        attributes: {
          "converge.route": "/api/calendar/entry-sync",
          "converge.provider": "mixed",
          "converge.sync_mode": "calendar",
          "converge.locale": locale ?? "unknown"
        }
      },
      () =>
        syncUserConnections({
          userId: user.id,
          mode: "calendar",
          calendarStaleMs: resolveEntrySyncStaleMs(),
          calendarMaxDeltaPagesPerCalendar: resolveEntrySyncMaxDeltaPages()
        })
    );

    await captureServerEvent({
      event: analyticsEvents.syncEntryAutoCompleted,
      distinctId: user.id,
      properties: {
        ok: summary.failures === 0,
        failures: summary.failures,
        connectionsScanned: summary.connectionsScanned,
        calendarSynced: summary.calendarSynced,
        peopleSynced: summary.peopleSynced,
        partials: summary.partials
      }
    });

    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    Sentry.withScope((scope) => {
      applyStandardSentryScopeTags(scope, {
        route: "/api/calendar/entry-sync",
        provider: "mixed",
        syncMode: "calendar",
        locale
      });
      scope.setUser({ id: user.id });
      Sentry.captureException(error);
    });
    await captureServerEvent({
      event: analyticsEvents.syncEntryAutoCompleted,
      distinctId: user.id,
      properties: { ok: false, reason: "entry_sync_failed" }
    });
    return NextResponse.json({ ok: false, error: "entry_sync_failed" }, { status: 500 });
  }
}
