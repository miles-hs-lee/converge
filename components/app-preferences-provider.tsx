"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { THEME_MODE_STORAGE_KEY, TENANT_COLORS_STORAGE_KEY, normalizeThemeMode, type ThemeMode } from "@/lib/preferences";
import { colorForTenant, normalizeHexColor, sanitizeTenantColorMap, type TenantColorMap } from "@/lib/tenant-colors";

type ResolvedTheme = "light" | "dark";

type AppPreferencesContextValue = {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  tenantColorMap: TenantColorMap;
  getTenantColor: (tenantName: string) => string;
  setTenantColor: (tenantName: string, color: string) => void;
  resetTenantColor: (tenantName: string) => void;
  resetAllTenantColors: () => void;
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyResolvedTheme(theme: ResolvedTheme) {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  root.classList.remove("theme-light", "theme-dark");
  root.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
  root.style.colorScheme = theme;
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [prefersDark, setPrefersDark] = useState<boolean>(false);
  const [tenantColorMap, setTenantColorMap] = useState<TenantColorMap>({});

  useEffect(() => {
    const nextMode = normalizeThemeMode(window.localStorage.getItem(THEME_MODE_STORAGE_KEY));
    setThemeModeState(nextMode);
    setPrefersDark(systemPrefersDark());

    const rawColors = window.localStorage.getItem(TENANT_COLORS_STORAGE_KEY);
    if (rawColors) {
      try {
        const parsed = JSON.parse(rawColors) as unknown;
        setTenantColorMap(sanitizeTenantColorMap(parsed));
      } catch {
        setTenantColorMap({});
      }
    }

    if (!window.matchMedia) {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setPrefersDark(Boolean(media.matches));
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);

  const resolvedTheme: ResolvedTheme = themeMode === "dark" || (themeMode === "system" && prefersDark) ? "dark" : "light";

  useEffect(() => {
    applyResolvedTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    }
  };

  const setTenantColor = (tenantName: string, color: string) => {
    const normalized = normalizeHexColor(color);
    if (!tenantName || !normalized) {
      return;
    }
    setTenantColorMap((prev) => {
      const next = { ...prev, [tenantName]: normalized };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TENANT_COLORS_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const resetTenantColor = (tenantName: string) => {
    if (!tenantName) return;
    setTenantColorMap((prev) => {
      const { [tenantName]: _, ...rest } = prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TENANT_COLORS_STORAGE_KEY, JSON.stringify(rest));
      }
      return rest;
    });
  };

  const resetAllTenantColors = () => {
    setTenantColorMap({});
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TENANT_COLORS_STORAGE_KEY);
    }
  };

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      themeMode,
      resolvedTheme,
      setThemeMode,
      tenantColorMap,
      getTenantColor: (tenantName: string) => colorForTenant(tenantName, tenantColorMap),
      setTenantColor,
      resetTenantColor,
      resetAllTenantColors
    }),
    [themeMode, resolvedTheme, tenantColorMap]
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences(): AppPreferencesContextValue {
  const ctx = useContext(AppPreferencesContext);
  if (!ctx) {
    return {
      themeMode: "system",
      resolvedTheme: "light",
      setThemeMode: () => {},
      tenantColorMap: {},
      getTenantColor: (tenantName: string) => colorForTenant(tenantName),
      setTenantColor: () => {},
      resetTenantColor: () => {},
      resetAllTenantColors: () => {}
    };
  }
  return ctx;
}
