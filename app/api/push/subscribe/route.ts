import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type SubscriptionBody = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("auth_required", 401);
  }

  let body: SubscriptionBody | null = null;
  try {
    body = (await request.json()) as SubscriptionBody;
  } catch {
    return jsonError("invalid_json");
  }

  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return jsonError("invalid_subscription");
  }

  const ua = request.headers.get("user-agent");

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: ua,
      is_active: true,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error) {
    return jsonError("db_error", 500);
  }

  return NextResponse.json({ ok: true });
}

