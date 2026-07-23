"use client";

import { useEffect } from "react";
import { buildStandardSentryTags } from "@/lib/observability/sentry-tags";

type SentryUserContextProps = {
  userId?: string | null;
  locale?: string | null;
};

export function SentryUserContext({ userId, locale }: SentryUserContextProps) {
  useEffect(() => {
    let cancelled = false;
    const timerId = window.setTimeout(() => {
      void import("@sentry/nextjs").then((Sentry) => {
        if (cancelled) {
          return;
        }
        const baseTags = buildStandardSentryTags({
          route: window.location.pathname,
          provider: "mixed",
          syncMode: "all",
          locale: locale ?? undefined
        });
        Object.entries(baseTags).forEach(([key, value]) => {
          Sentry.setTag(key, value);
        });
        Sentry.setUser(userId ? { id: userId } : null);
      });
    }, 2_000);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [locale, userId]);

  return null;
}
