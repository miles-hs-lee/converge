"use client";

import { useAppPreferences } from "@/components/app-preferences-provider";
import { useT } from "@/components/locale-provider";
import type { ThemeMode } from "@/lib/preferences";

const options: Array<{ value: ThemeMode; labelKey: "settings.theme.system" | "settings.theme.light" | "settings.theme.dark" }> = [
  { value: "system", labelKey: "settings.theme.system" },
  { value: "light", labelKey: "settings.theme.light" },
  { value: "dark", labelKey: "settings.theme.dark" }
];

export function ThemeSelector() {
  const t = useT();
  const { themeMode, resolvedTheme, setThemeMode } = useAppPreferences();

  return (
    <div>
      <div className="inline-flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = themeMode === opt.value;
          return (
            <button
              className={`btn ${active ? "btn-primary" : "btn-secondary"} px-3 py-1.5`}
              key={opt.value}
              onClick={() => setThemeMode(opt.value)}
              type="button"
            >
              {t(opt.labelKey)}
            </button>
          );
        })}
      </div>
      <p className="muted mt-2">{t("settings.theme.current", { value: t(resolvedTheme === "dark" ? "settings.theme.dark" : "settings.theme.light") })}</p>
    </div>
  );
}
