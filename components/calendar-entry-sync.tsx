"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ENTRY_SYNC_THROTTLE_KEY = "converge_calendar_entry_sync_last_at";
const ENTRY_SYNC_THROTTLE_MS = 60 * 1000;
const ENTRY_SYNC_WAIT_MS = 4_000;

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
  const router = useRouter();

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const triggerSync = () => {
      if (document.visibilityState !== "visible") {
        scheduled = false;
        return;
      }

      const now = Date.now();
      if (!shouldTriggerByThrottle(now)) {
        return;
      }

      void fetch("/api/calendar/entry-sync", {
        method: "POST",
        keepalive: true
      })
        .then(async (response) => {
          if (!response.ok) {
            return;
          }
          const payload = (await response.json()) as { ok?: boolean; calendarSynced?: number; failures?: number };
          if (payload.ok && (payload.calendarSynced ?? 0) > 0 && (payload.failures ?? 0) === 0) {
            router.refresh();
          }
        })
        .catch(() => {
          // Best-effort refresh only.
        });
    };

    let cancelled = false;
    let scheduled = false;
    let idleId: number | null = null;
    let timerId: number | null = null;

    const scheduleSync = () => {
      if (cancelled || scheduled || document.visibilityState !== "visible") {
        return;
      }
      scheduled = true;

      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(
          () => {
            if (!cancelled) {
              triggerSync();
            }
          },
          { timeout: 2_500 }
        );
        return;
      }

      timerId = window.setTimeout(() => {
        if (!cancelled) {
          triggerSync();
        }
      }, 1_200);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        scheduleSync();
      }
    };

    const onUserIntent = () => {
      scheduleSync();
    };

    const bootstrapTimerId = window.setTimeout(scheduleSync, ENTRY_SYNC_WAIT_MS);
    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pointerdown", onUserIntent, { once: true, passive: true });
    window.addEventListener("keydown", onUserIntent, { once: true });

    return () => {
      cancelled = true;
      window.clearTimeout(bootstrapTimerId);
      if (idleId !== null) {
        window.cancelIdleCallback?.(idleId);
      }
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pointerdown", onUserIntent);
      window.removeEventListener("keydown", onUserIntent);
    };
  }, [enabled, router]);

  return null;
}
