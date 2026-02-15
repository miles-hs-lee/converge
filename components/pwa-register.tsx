"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Register ASAP; required for push subscription and installability.
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Best-effort; PWA installability should not break the app.
    });
  }, []);

  return null;
}
