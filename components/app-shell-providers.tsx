"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { AnalyticsIdentity } from "@/components/analytics/analytics-identity";
import { AppPreferencesProvider } from "@/components/app-preferences-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { PwaRegister } from "@/components/pwa-register";
import { SentryUserContext } from "@/components/sentry-user-context";
import type { I18nMessages, Locale } from "@/lib/i18n";

function DebugNavLoader() {
  const [Logger, setLogger] = useState<ComponentType | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debugNav") !== "1") {
      return;
    }

    let cancelled = false;
    void import("@/components/nav-debug-logger").then((mod) => {
      if (!cancelled) {
        setLogger(() => mod.NavDebugLogger);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return Logger ? <Logger /> : null;
}

type AppShellProvidersProps = {
  children: ReactNode;
  locale: Locale;
  messages: I18nMessages;
  userId?: string | null;
};

export function AppShellProviders({ children, locale, messages, userId }: AppShellProvidersProps) {
  return (
    <AppPreferencesProvider>
      <LocaleProvider initialLocale={locale} initialMessages={messages}>
        <AnalyticsIdentity userId={userId} />
        <SentryUserContext locale={locale} userId={userId} />
        <PwaRegister />
        <DebugNavLoader />
        {children}
      </LocaleProvider>
    </AppPreferencesProvider>
  );
}
