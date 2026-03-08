"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { buildStandardSentryTags } from "@/lib/observability/sentry-tags";

type SentryUserContextProps = {
  userId?: string | null;
  locale?: string | null;
};

export function SentryUserContext({ userId, locale }: SentryUserContextProps) {
  useEffect(() => {
    const baseTags = buildStandardSentryTags({
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
      provider: "mixed",
      syncMode: "all",
      locale: locale ?? undefined
    });
    Object.entries(baseTags).forEach(([key, value]) => {
      Sentry.setTag(key, value);
    });

    if (!userId) {
      Sentry.setUser(null);
      return;
    }
    Sentry.setUser({ id: userId });
  }, [locale, userId]);

  return null;
}
