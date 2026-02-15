import webpush from "web-push";
import { serverEnv } from "@/lib/env/server";

let configured = false;

export function getWebPush() {
  const publicKey = serverEnv.vapidPublicKey;
  const privateKey = serverEnv.vapidPrivateKey;
  const subject = serverEnv.vapidSubject;

  if (!publicKey || !privateKey || !subject) {
    throw new Error("Missing VAPID env. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.");
  }

  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }

  return webpush;
}

export function getVapidPublicKey(): string | null {
  return serverEnv.vapidPublicKey ?? null;
}

