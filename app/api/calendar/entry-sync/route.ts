import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncUserConnections } from "@/lib/connection-sync";
import { isMockMode } from "@/lib/mock-mode";

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

export async function POST() {
  if (isMockMode) {
    return NextResponse.json({ ok: true, skipped: "mock_mode" });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  try {
    const summary = await syncUserConnections({
      userId: user.id,
      mode: "calendar",
      calendarStaleMs: resolveEntrySyncStaleMs(),
      calendarMaxDeltaPagesPerCalendar: resolveEntrySyncMaxDeltaPages()
    });

    return NextResponse.json({ ok: true, ...summary });
  } catch {
    return NextResponse.json({ ok: false, error: "entry_sync_failed" }, { status: 500 });
  }
}
