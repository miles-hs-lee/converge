import { type EmailOtpType, type User } from "@supabase/supabase-js";
import * as Sentry from "@sentry/nextjs";
import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncUserConnections } from "@/lib/connection-sync";
import { applyStandardSentryScopeTags } from "@/lib/observability/sentry-tags";

function resolveLoginSyncMaxDeltaPages(): number {
  const raw = process.env.CALENDAR_ENTRY_SYNC_MAX_DELTA_PAGES;
  const n = raw ? Number(raw) : 40;
  if (!Number.isFinite(n) || n <= 0) {
    return 40;
  }
  return Math.floor(n);
}

async function recordLastLoginTimestamps(supabase: Awaited<ReturnType<typeof createClient>>, user: User) {
  if (!user.email) {
    return;
  }

  const nowIso = new Date().toISOString();
  const { data: existing } = await supabase.from("app_users").select("last_login_at").eq("id", user.id).maybeSingle();
  const previousLoginAt = existing?.last_login_at ?? null;

  await supabase.from("app_users").upsert(
    {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name ?? user.email,
      prev_login_at: previousLoginAt,
      last_login_at: nowIso,
      updated_at: nowIso
    },
    { onConflict: "id" }
  );
}

async function runPostLoginCalendarSync(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User,
  locale?: string
) {
  try {
    await recordLastLoginTimestamps(supabase, user);
  } catch (error) {
    Sentry.withScope((scope) => {
      applyStandardSentryScopeTags(scope, {
        route: "/auth/callback",
        provider: "mixed",
        syncMode: "all",
        locale
      });
      scope.setTag("task", "record_last_login");
      scope.setUser({ id: user.id });
      Sentry.captureException(error);
    });
    // Login timestamp update should not block login success.
  }

  try {
    await syncUserConnections({
      userId: user.id,
      mode: "calendar",
      calendarStaleMs: 0,
      calendarMaxDeltaPagesPerCalendar: resolveLoginSyncMaxDeltaPages()
    });
  } catch (error) {
    Sentry.withScope((scope) => {
      applyStandardSentryScopeTags(scope, {
        route: "/auth/callback",
        provider: "mixed",
        syncMode: "calendar",
        locale
      });
      scope.setTag("task", "post_login_calendar_sync");
      scope.setUser({ id: user.id });
      Sentry.captureException(error);
    });
    // Post-login sync should not block login success.
  }
}

function captureAuthCallbackError(params: {
  error: unknown;
  method: "pkce" | "otp";
  locale?: string;
}) {
  const { error, method, locale } = params;
  Sentry.withScope((scope) => {
    applyStandardSentryScopeTags(scope, {
      route: "/auth/callback",
      provider: "supabase",
      syncMode: "none",
      locale
    });
    scope.setTag("task", "auth_callback_exchange");
    scope.setTag("auth_method", method);
    if (error && typeof error === "object") {
      const candidate = error as { code?: unknown; name?: unknown; status?: unknown };
      if (typeof candidate.code === "string") {
        scope.setTag("auth_error_code", candidate.code.slice(0, 80));
      }
      if (typeof candidate.name === "string") {
        scope.setTag("auth_error_name", candidate.name.slice(0, 80));
      }
      if (typeof candidate.status === "number") {
        scope.setTag("auth_error_status", String(candidate.status));
      }
    }
    Sentry.captureException(error instanceof Error ? error : new Error("auth_callback_exchange_failed"));
  });
}

function schedulePostLoginTasks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: User,
  locale?: string
) {
  after(async () => {
    await runPostLoginCalendarSync(supabase, user, locale);
  });
}

function sanitizeNextPath(raw: string | null): string {
  if (!raw) {
    return "/calendar";
  }

  const next = raw.trim();
  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/calendar";
  }

  if (next.includes("\n") || next.includes("\r") || next.includes("\\")) {
    return "/calendar";
  }

  return next;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const locale =
    request.headers
      .get("accept-language")
      ?.split(",")
      .map((token) => token.split(";")[0]?.trim())
      .find((token): token is string => Boolean(token && token.length > 0)) ?? undefined;
  const code = url.searchParams.get("code");
  const nextPath = sanitizeNextPath(url.searchParams.get("next"));
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const user = data.user ?? data.session?.user;
      if (user) {
        schedulePostLoginTasks(supabase, user, locale);
      }
      return NextResponse.redirect(new URL(nextPath, request.url));
    }
    captureAuthCallbackError({ error, method: "pkce", locale });
  }

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const user = data.user ?? data.session?.user;
      if (user) {
        schedulePostLoginTasks(supabase, user, locale);
      }
      return NextResponse.redirect(new URL(nextPath, request.url));
    }
    captureAuthCallbackError({ error, method: "otp", locale });
  }

  return NextResponse.redirect(new URL("/login?status=auth_callback_error", request.url));
}
