import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectTenantConflicts } from "@/lib/calendar-conflicts";
import { getWebPush } from "@/lib/web-push";
import { serverEnv } from "@/lib/env/server";
import { normalizeLocale, t } from "@/lib/i18n";

function isAuthorized(request: NextRequest): boolean {
  const configured = serverEnv.cronSecret;
  if (!configured) {
    // If no secret is configured, do not allow public triggering in production.
    return process.env.NODE_ENV !== "production";
  }
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${configured}`;
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return jsonError("unauthorized", 401);
  }

  const admin = createAdminClient();
  const webpush = getWebPush();

  const { data: subs, error: subsError } = await admin
    .from("push_subscriptions")
    .select("user_id,endpoint,p256dh,auth")
    .eq("is_active", true)
    .limit(1000);

  if (subsError) {
    return jsonError("db_push_subscriptions_failed", 500);
  }

  const subsByUser = new Map<string, Array<{ endpoint: string; p256dh: string; auth: string }>>();
  (subs ?? []).forEach((row) => {
    const arr = subsByUser.get(row.user_id) ?? [];
    arr.push({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth });
    subsByUser.set(row.user_id, arr);
  });

  const now = Date.now();
  const fromIso = new Date(now).toISOString();
  const toIso = new Date(now + 1000 * 60 * 60 * 48).toISOString(); // next 48h
  const cutoffIso = new Date(now - 1000 * 60 * 60 * 6).toISOString(); // dedup window: 6h

  let usersScanned = 0;
  let usersNotified = 0;
  let pushesSent = 0;
  let pushesFailed = 0;

  for (const [userId, userSubs] of subsByUser.entries()) {
    usersScanned += 1;

    const { data: userRow } = await admin.from("app_users").select("locale").eq("id", userId).maybeSingle();
    const locale = normalizeLocale(userRow?.locale ?? undefined);
    const tt = (key: Parameters<typeof t>[1], vars?: Parameters<typeof t>[2]) => t(locale, key, vars);

    const { data: connections, error: connError } = await admin
      .from("m365_connections")
      .select("id,tenant_name")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: true });
    if (connError || !connections || connections.length === 0) {
      continue;
    }

    const tenantByConn = new Map<string, string>();
    const connIds: string[] = [];
    connections.forEach((c) => {
      connIds.push(c.id);
      tenantByConn.set(c.id, c.tenant_name ?? "Connected Tenant");
    });

    const { data: events, error: eventsError } = await admin
      .from("calendar_events_cache")
      .select("id,subject,start_at,end_at,connection_id")
      .in("connection_id", connIds)
      .gte("start_at", fromIso)
      .lte("start_at", toIso)
      .order("start_at", { ascending: true })
      .limit(800);

    if (eventsError || !events || events.length === 0) {
      continue;
    }

    const conflicts = detectTenantConflicts(
      events.map((e) => ({
        id: e.id,
        tenantName: tenantByConn.get(e.connection_id) ?? "Connected Tenant",
        subject: e.subject ?? "(Untitled)",
        startAt: e.start_at,
        endAt: e.end_at
      }))
    );

    if (conflicts.length === 0) {
      continue;
    }

    const { data: recentDedup } = await admin
      .from("alert_dedup")
      .select("key,last_sent_at")
      .eq("user_id", userId)
      .gte("last_sent_at", cutoffIso)
      .limit(2000);

    const recentKeys = new Set((recentDedup ?? []).map((r) => r.key));
    const unsent = conflicts.filter((c) => !recentKeys.has(c.key));
    if (unsent.length === 0) {
      continue;
    }

    const first = unsent[0]!;
    const overlapStart = new Date(first.overlapStart).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    const overlapEnd = new Date(first.overlapEnd).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    const payload = JSON.stringify({
      title: tt("alerts.notificationTitle", { count: unsent.length }),
      body: tt("alerts.notificationBody", {
        a: first.a.tenantName,
        b: first.b.tenantName,
        start: overlapStart,
        end: overlapEnd
      }),
      url: "/calendar",
      tag: "converge-conflict",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png"
    });

    let anySuccess = false;
    for (const sub of userSubs) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 300 });
        pushesSent += 1;
        anySuccess = true;
      } catch (err: any) {
        pushesFailed += 1;
        const statusCode = typeof err?.statusCode === "number" ? err.statusCode : null;
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").update({ is_active: false, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("endpoint", sub.endpoint);
        }
      }
    }

    if (anySuccess) {
      usersNotified += 1;
      const nowIso = new Date().toISOString();
      await admin.from("alert_dedup").upsert(
        unsent.slice(0, 25).map((c) => ({ user_id: userId, key: c.key, last_sent_at: nowIso })),
        { onConflict: "user_id,key" }
      );
    }
  }

  return NextResponse.json({ ok: true, usersScanned, usersNotified, pushesSent, pushesFailed });
}

