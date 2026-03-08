"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, formatI18nTemplate, intlLocale } from "@/lib/i18n-core";
import type { I18nKey, I18nMessages, Locale } from "@/lib/i18n";

type LocaleContextValue = {
  locale: Locale;
  messages: I18nMessages;
  setLocale: (next: Locale, nextMessages?: I18nMessages) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const EMPTY_MESSAGES = {} as I18nMessages;

export function LocaleProvider({
  children,
  initialLocale,
  initialMessages
}: {
  children: ReactNode;
  initialLocale: Locale;
  initialMessages: I18nMessages;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);
  const [messages, setMessages] = useState<I18nMessages>(initialMessages);

  useEffect(() => {
    setLocale(initialLocale ?? DEFAULT_LOCALE);
    setMessages(initialMessages);
  }, [initialLocale, initialMessages]);

  const value = useMemo(
    () => ({
      locale,
      messages,
      setLocale: (next: Locale, nextMessages?: I18nMessages) => {
        setLocale(next);
        if (nextMessages) {
          setMessages(nextMessages);
        }
      }
    }),
    [locale, messages]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return { locale: DEFAULT_LOCALE, messages: EMPTY_MESSAGES, setLocale: () => {} };
  }
  return ctx;
}

export function useT() {
  const { messages } = useLocale();
  return useMemo(() => {
    return (key: I18nKey, vars?: Record<string, string | number>) => formatI18nTemplate(messages[key] ?? key, vars);
  }, [messages]);
}

export function useIntlLocale() {
  const { locale } = useLocale();
  return intlLocale(locale);
}
