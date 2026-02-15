"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, intlLocale, t, type I18nKey, type Locale } from "@/lib/i18n";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children, initialLocale }: { children: ReactNode; initialLocale: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);
  const value = useMemo(() => ({ locale, setLocale }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return { locale: DEFAULT_LOCALE, setLocale: () => {} };
  }
  return ctx;
}

export function useT() {
  const { locale } = useLocale();
  return useMemo(() => {
    return (key: I18nKey, vars?: Record<string, string | number>) => t(locale, key, vars);
  }, [locale]);
}

export function useIntlLocale() {
  const { locale } = useLocale();
  return intlLocale(locale);
}

