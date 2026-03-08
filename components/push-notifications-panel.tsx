"use client";

import { useEffect, useMemo, useState } from "react";
import { useT, useIntlLocale } from "@/components/locale-provider";
import { trackClientEvent } from "@/lib/analytics/client";
import { analyticsEvents } from "@/lib/analytics/events";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array<ArrayBuffer>(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type PanelProps = {
  enabled: boolean;
};

export function PushNotificationsPanel({ enabled }: PanelProps) {
  const t = useT();
  const intl = useIntlLocale();

  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [lastTestAt, setLastTestAt] = useState<string | null>(null);

  const canUse = useMemo(() => supported && Boolean(publicKey), [publicKey, supported]);

  useEffect(() => {
    const sw = typeof navigator !== "undefined" && "serviceWorker" in navigator;
    const push = typeof window !== "undefined" && "PushManager" in window;
    const notif = typeof window !== "undefined" && "Notification" in window;
    setSupported(Boolean(sw && push && notif));
    if (notif) {
      setPermission(Notification.permission);
    }

    (async () => {
      try {
        const res = await fetch("/api/push/public-key", { cache: "no-store" });
        if (!res.ok) {
          setPublicKey(null);
          return;
        }
        const data = (await res.json()) as { publicKey?: string | null };
        setPublicKey(data.publicKey ?? null);
      } catch {
        setPublicKey(null);
      }
    })();

    (async () => {
      if (!sw) return;
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(Boolean(sub));
        setEndpoint(sub?.endpoint ?? null);
      } catch {
        setSubscribed(false);
        setEndpoint(null);
      }
    })();

    try {
      setLastTestAt(localStorage.getItem("converge_push_last_test"));
    } catch {
      setLastTestAt(null);
    }
  }, []);

  async function subscribe() {
    if (!enabled) {
      setStatus(t("push.loginRequired"));
      return;
    }
    if (!canUse || !publicKey) {
      setStatus(t("push.configMissing"));
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const previousPermission = permission;
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      void trackClientEvent(analyticsEvents.notificationsPermissionChanged, {
        source: "push_panel",
        previousPermission,
        nextPermission: permissionResult
      });
      if (permissionResult !== "granted") {
        setStatus(t("push.permissionBlocked"));
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource
      });

      const json = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json)
      });

      if (!res.ok) {
        setStatus(t("push.subscribeFailed"));
        return;
      }

      setSubscribed(true);
      setEndpoint(sub.endpoint);
      setStatus(t("push.subscribed"));
    } catch {
      setStatus(t("push.subscribeFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    setStatus(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setEndpoint(null);
      setStatus(t("push.unsubscribed"));
    } catch {
      setStatus(t("push.unsubscribeFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function testPush() {
    if (!enabled) {
      setStatus(t("push.loginRequired"));
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      if (!res.ok) {
        setStatus(t("push.testFailed"));
        return;
      }
      const nowIso = new Date().toISOString();
      localStorage.setItem("converge_push_last_test", nowIso);
      setLastTestAt(nowIso);
      setStatus(t("push.testSent"));
    } catch {
      setStatus(t("push.testFailed"));
    } finally {
      setBusy(false);
    }
  }

  const permissionLabel = permission === "unsupported" ? "unsupported" : permission;

  return (
    <div className="mt-4 space-y-3">
      {!supported ? <p className="text-sm text-muted">{t("push.notSupported")}</p> : null}
      {supported && !publicKey ? <p className="text-sm text-muted">{t("push.configMissing")}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="badge">{t("push.permission", { value: permissionLabel })}</span>
        <span className="badge">{subscribed ? t("push.status.subscribed") : t("push.status.notSubscribed")}</span>
        {lastTestAt ? <span className="badge">{t("push.lastTest", { value: new Date(lastTestAt).toLocaleString(intl) })}</span> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {subscribed ? (
          <button className="btn btn-secondary" disabled={busy} onClick={unsubscribe} type="button">
            {t("push.unsubscribe")}
          </button>
        ) : (
          <button className="btn btn-primary" disabled={busy || !supported} onClick={subscribe} type="button">
            {t("push.subscribe")}
          </button>
        )}
        <button className="btn btn-secondary" disabled={busy || !supported || !subscribed} onClick={testPush} type="button">
          {t("push.test")}
        </button>
      </div>

      {status ? <p className="text-sm text-muted">{status}</p> : null}
      {endpoint ? <p className="break-all text-xs text-muted">{t("push.endpointHint", { value: endpoint })}</p> : null}
    </div>
  );
}
