import Link from "next/link";
import type { Route } from "next";
import { CalendarDays, AlertTriangle, Users, Settings, LogOut } from "lucide-react";
import { signOutAction } from "@/app/(app)/actions";
import { isMockMode } from "@/lib/mock-mode";
import { BrandLogo } from "@/components/brand-logo";
import { getServerLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

type TopNavProps = {
  userEmail?: string | null;
};

export async function TopNav({ userEmail }: TopNavProps) {
  const locale = await getServerLocale();
  const tt = (key: Parameters<typeof t>[1]) => t(locale, key);

  const tabs: Array<{ href: string; label: string; icon: typeof CalendarDays }> = [
    { href: "/calendar", label: tt("nav.calendar"), icon: CalendarDays },
    { href: "/alerts", label: tt("nav.alerts"), icon: AlertTriangle },
    { href: "/people", label: tt("nav.people"), icon: Users },
    { href: "/settings", label: tt("nav.settings"), icon: Settings }
  ];

  return (
    <header className="sticky top-0 z-30 pt-3" data-testid="top-nav">
      <div className="page-wrap">
        <div className="panel-glass card flex flex-wrap items-center justify-between gap-3 px-3 py-3 md:px-4">
          <div className="flex items-center gap-2">
            <Link className="inline-flex items-center" data-testid="nav-brand" href="/calendar">
              <BrandLogo compact />
            </Link>
            {isMockMode ? <span className="badge border-sky-200 bg-sky-50 text-sky-700">MOCK</span> : null}
          </div>

          <nav className="order-3 w-full md:order-2 md:w-auto">
            <div className="grid grid-cols-4 gap-2 rounded-xl border border-line bg-white/85 p-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const testId = `nav-tab-${String(tab.href).replace(/^\//, "")}`;
                return (
                  <Link
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-accent/10 hover:text-accent sm:gap-2 sm:px-3 sm:text-sm"
                    data-testid={testId}
                    href={tab.href as Route}
                    key={tab.href}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="order-2 flex items-center gap-2 md:order-3">
            {userEmail ? (
              <>
                <span className="hidden max-w-44 truncate rounded-full border border-line bg-white/90 px-3 py-1.5 text-xs text-muted lg:inline-flex">
                  {userEmail}
                </span>
                <form action={signOutAction}>
                  <button className="btn btn-secondary px-3 py-1.5" data-testid="nav-logout" type="submit">
                    <LogOut size={14} />
                    <span className="hidden sm:inline">{tt("nav.logout")}</span>
                  </button>
                </form>
              </>
            ) : (
              <Link className="btn btn-secondary px-3 py-1.5" data-testid="nav-login" href="/login">
                {tt("nav.login")}
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
