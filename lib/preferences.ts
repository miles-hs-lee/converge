export type ThemeMode = "system" | "light" | "dark";

export const THEME_MODE_STORAGE_KEY = "converge_theme_mode";
export const TENANT_COLORS_STORAGE_KEY = "converge_tenant_colors";

export function normalizeThemeMode(value: string | null | undefined): ThemeMode {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}
