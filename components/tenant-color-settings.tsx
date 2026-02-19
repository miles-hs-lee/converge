"use client";

import { useMemo } from "react";
import { useAppPreferences } from "@/components/app-preferences-provider";
import { useT } from "@/components/locale-provider";

export function TenantColorSettings({ tenants }: { tenants: string[] }) {
  const t = useT();
  const { getTenantColor, setTenantColor, resetTenantColor, resetAllTenantColors } = useAppPreferences();

  const uniqueTenants = useMemo(() => {
    return [...new Set(tenants.map((tenant) => tenant.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [tenants]);

  if (uniqueTenants.length === 0) {
    return <p className="mt-3 text-sm text-muted">{t("settings.tenantColorsEmpty")}</p>;
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex justify-end">
        <button className="btn btn-secondary px-3 py-1.5" onClick={resetAllTenantColors} type="button">
          {t("settings.tenantColorResetAll")}
        </button>
      </div>

      <div className="grid gap-2">
        {uniqueTenants.map((tenant) => {
          const color = getTenantColor(tenant);
          return (
            <article className="rounded-xl border border-line bg-white/85 p-3" key={tenant}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{tenant}</p>
                  <p className="mt-1 text-xs text-muted">{color}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-md border border-line" style={{ backgroundColor: color }} />
                  <input
                    aria-label={`${tenant} ${t("settings.tenantColorLabel")}`}
                    className="h-9 w-10 cursor-pointer rounded-md border border-line bg-transparent p-0"
                    onChange={(event) => setTenantColor(tenant, event.target.value)}
                    type="color"
                    value={color}
                  />
                  <button className="btn btn-secondary px-2.5 py-1.5 text-xs" onClick={() => resetTenantColor(tenant)} type="button">
                    {t("settings.tenantColorReset")}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
