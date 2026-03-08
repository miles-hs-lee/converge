"use client";

import { useAppPreferences } from "@/components/app-preferences-provider";
import { useT } from "@/components/locale-provider";
import type { CalendarWeekStart } from "@/lib/preferences";

const options: Array<{ value: CalendarWeekStart; labelKey: "settings.weekStart.sunday" | "settings.weekStart.monday" }> = [
  { value: "sun", labelKey: "settings.weekStart.sunday" },
  { value: "mon", labelKey: "settings.weekStart.monday" }
];

export function CalendarLayoutSelector() {
  const t = useT();
  const { calendarWeekStart, setCalendarWeekStart } = useAppPreferences();

  return (
    <div>
      <p className="text-sm font-medium text-text">{t("settings.calendarWeekStartLabel")}</p>
      <div className="mt-2 inline-flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = calendarWeekStart === opt.value;
          return (
            <button
              className={`btn ${active ? "btn-primary" : "btn-secondary"} px-3 py-1.5`}
              key={opt.value}
              onClick={() => setCalendarWeekStart(opt.value)}
              type="button"
            >
              {t(opt.labelKey)}
            </button>
          );
        })}
      </div>
      <p className="muted mt-2">
        {t("settings.weekStart.current", {
          value: t(calendarWeekStart === "sun" ? "settings.weekStart.sunday" : "settings.weekStart.monday")
        })}
      </p>
    </div>
  );
}
