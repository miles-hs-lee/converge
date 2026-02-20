import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncUserConnections } from "@/lib/connection-sync";

function resolveLoginSyncMaxDeltaPages(): number {
  const raw = process.env.CALENDAR_ENTRY_SYNC_MAX_DELTA_PAGES;
  const n = raw ? Number(raw) : 4;
  if (!Number.isFinite(n) || n <= 0) {
    return 4;
  }
  return Math.floor(n);
}

async function runPostLoginCalendarSync(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  try {
    await syncUserConnections({
      userId: user.id,
      mode: "calendar",
      calendarStaleMs: 0,
      calendarMaxDeltaPagesPerCalendar: resolveLoginSyncMaxDeltaPages()
    });
  } catch {
    // Post-login sync should not block login success.
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/calendar";
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await runPostLoginCalendarSync(supabase);
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      await runPostLoginCalendarSync(supabase);
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?status=auth_callback_error", request.url));
}
