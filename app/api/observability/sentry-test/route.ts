import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

function isTestEndpointEnabled(): boolean {
  return process.env.SENTRY_ENABLE_TEST_ENDPOINT === "true";
}

function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }
  return origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!isTestEndpointEnabled()) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ ok: false, error: "forbidden_origin" }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }

  const allowed = await consumeRateLimit({
    scope: "sentry_test_backend",
    actor: user.id,
    limit: 3,
    windowSeconds: 60
  });
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }

  const causeRaw = request.nextUrl.searchParams.get("cause");
  const cause = causeRaw?.trim().slice(0, 60) || "manual";

  try {
    throw new Error(`converge_sentry_test_backend_${Date.now()}_${cause}`);
  } catch (error) {
    const eventId = Sentry.withScope((scope) => {
      scope.setTag("route", "/api/observability/sentry-test");
      scope.setTag("source", "manual_backend_test");
      scope.setTag("cause", cause);
      scope.setUser({ id: user.id });
      return Sentry.captureException(error);
    });
    await Sentry.flush(1500);
    return NextResponse.json({ ok: true, eventId, cause });
  }
}
