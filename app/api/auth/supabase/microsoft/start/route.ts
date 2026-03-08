import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyticsEvents } from "@/lib/analytics/events";
import { captureServerEvent } from "@/lib/analytics/server";

function getAppUrl(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  await captureServerEvent({
    event: analyticsEvents.oauthStart,
    distinctId: "anonymous",
    properties: { provider: "microsoft", flow: "supabase", surface: "login" }
  });

  const supabase = await createClient();
  const redirectTo = `${getAppUrl(request)}/auth/callback?next=/calendar`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      redirectTo,
      scopes: "openid profile email",
      queryParams: {
        prompt: "select_account"
      }
    }
  });

  if (error || !data?.url) {
    await captureServerEvent({
      event: analyticsEvents.oauthFailed,
      distinctId: "anonymous",
      properties: { provider: "microsoft", reasonCode: "microsoft_sso_error", flow: "supabase", surface: "login" }
    });
    return NextResponse.redirect(new URL("/login?status=microsoft_sso_error", request.url));
  }

  return NextResponse.redirect(data.url);
}
