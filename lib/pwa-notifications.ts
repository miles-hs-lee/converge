export type PwaNotificationResult =
  | { ok: true; via: "service_worker" | "window"; permission: NotificationPermission }
  | { ok: false; reason: "unsupported" | "permission_denied" | "permission_default" | "no_sw_registration" | "failed" };

export function getNotificationPermissionSafe(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined") return "unsupported";
  if (typeof window.Notification === "undefined") return "unsupported";
  try {
    return Notification.permission;
  } catch {
    return "unsupported";
  }
}

export async function sendPwaNotification(params: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
}): Promise<PwaNotificationResult> {
  if (typeof window === "undefined" || typeof window.Notification === "undefined") {
    return { ok: false, reason: "unsupported" };
  }

  const permission = Notification.permission;
  if (permission === "denied") return { ok: false, reason: "permission_denied" };
  if (permission !== "granted") return { ok: false, reason: "permission_default" };

  const {
    title,
    body,
    url = "/calendar",
    tag = "converge-alert",
    icon = "/icons/icon-192.png",
    badge = "/icons/icon-192.png"
  } = params;

  // Prefer ServiceWorkerRegistration.showNotification() so it behaves like PWA/app notifications on Android.
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return { ok: false, reason: "no_sw_registration" };

      const options: NotificationOptions & { data?: unknown } = {
        body,
        tag,
        icon,
        badge,
        data: { url }
      };
      // Chromium supports this; TS types may lag.
      (options as unknown as { renotify?: boolean }).renotify = true;
      (options as unknown as { requireInteraction?: boolean }).requireInteraction = true;
      (options as unknown as { vibrate?: number[] }).vibrate = [120, 60, 120];

      await reg.showNotification(title, options);

      return { ok: true, via: "service_worker", permission };
    } catch {
      // fall through to window notification
    }
  }

  try {
    // Fallback when SW isn't ready yet.
    // eslint-disable-next-line no-new
    new Notification(title, { body, tag });
    return { ok: true, via: "window", permission };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
