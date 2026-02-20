"use client";

import { useEffect } from "react";

const ENTRY_SYNC_THROTTLE_KEY = "converge_calendar_entry_sync_last_at";
const ENTRY_SYNC_THROTTLE_MS = 60 * 1000;

type CalendarEntrySyncProps = {
  enabled: boolean;
};

function shouldTriggerByThrottle(now: number): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const lastRaw = window.sessionStorage.getItem(ENTRY_SYNC_THROTTLE_KEY);
  const last = lastRaw ? Number(lastRaw) : 0;
  if (!Number.isFinite(last) || now - last >= ENTRY_SYNC_THROTTLE_MS) {
    window.sessionStorage.setItem(ENTRY_SYNC_THROTTLE_KEY, String(now));
    return true;
  }
  return false;
}

export function CalendarEntrySync({ enabled }: CalendarEntrySyncProps) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const now = Date.now();
    if (!shouldTriggerByThrottle(now)) {
      return;
    }

    void fetch("/api/calendar/entry-sync", {
      method: "POST",
      keepalive: true
    }).catch(() => {
      // Best-effort refresh only.
    });
  }, [enabled]);

  return null;
}
