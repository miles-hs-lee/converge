import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWebPush } from "@/lib/web-push";
import { consumeRateLimit } from "@/lib/rate-limit";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return jsonError("auth_required", 401);
  }

  const allowed = await consumeRateLimit({
    scope: "push_test",
    actor: user.id,
    limit: 3,
    windowSeconds: 60
  });
  if (!allowed) {
    return jsonError("rate_limited", 429);
  }

  const admin = createAdminClient();
  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(10);

  if (error) {
    return jsonError("db_error", 500);
  }

  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
  }

  const webpush = getWebPush();
  const payload = JSON.stringify({
    title: "Converge",
    body: "Background push test (PWA)",
    url: "/calendar",
    tag: "converge-push-test",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png"
  });

  let sent = 0;
  let skipped = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 60 }
      );
      sent += 1;
    } catch {
      skipped += 1;
    }
  }

  return NextResponse.json({ ok: true, sent, skipped });
}
