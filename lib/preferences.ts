export type ThemeMode = "system" | "light" | "dark";
export type CalendarWeekStart = "sun" | "mon";

export const THEME_MODE_STORAGE_KEY = "converge_theme_mode";
export const TENANT_COLORS_STORAGE_KEY = "converge_tenant_colors";
export const CALENDAR_WEEK_START_STORAGE_KEY = "converge_calendar_week_start";

export function normalizeThemeMode(value: string | null | undefined): ThemeMode {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system";
}

export function normalizeCalendarWeekStart(value: string | null | undefined): CalendarWeekStart {
  if (value === "sun" || value === "mon") {
    return value;
  }
  return "mon";
}
