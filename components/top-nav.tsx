import { LogOut } from "lucide-react";
import Link from "next/link";
import { signOutAction } from "@/app/(app)/actions";
import { isMockMode } from "@/lib/mock-mode";
import { BrandLogo } from "@/components/brand-logo";
import { t, type Locale } from "@/lib/i18n";
import { NavTabButton } from "@/components/nav-tab-button";

type TopNavProps = {
  locale: Locale;
  userEmail?: string | null;
};

type AppTabHref = "/calendar" | "/alerts" | "/people" | "/settings";
type AppTabIcon = "calendar" | "alerts" | "people" | "settings";

export async function TopNav({ locale, userEmail }: TopNavProps) {
  const tt = (key: Parameters<typeof t>[1]) => t(locale, key);

  const tabs: Array<{ href: AppTabHref; label: string; icon: AppTabIcon }> = [
    { href: "/calendar", label: tt("nav.calendar"), icon: "calendar" },
    { href: "/alerts", label: tt("nav.alerts"), icon: "alerts" },
    { href: "/people", label: tt("nav.people"), icon: "people" },
    { href: "/settings", label: tt("nav.settings"), icon: "settings" }
  ];

  return (
    <header className="sticky top-0 z-[90] pt-3" data-testid="top-nav">
      <div className="page-wrap">
        <div className="panel-glass card flex items-center gap-2 px-2.5 py-2.5 md:gap-3 md:px-4 md:py-3">
          <div className="flex shrink-0 items-center gap-2">
            <Link className="inline-flex items-center" data-testid="nav-brand" href="/calendar">
              <BrandLogo compact />
            </Link>
            {isMockMode ? <span className="badge border-sky-200 bg-sky-50 text-sky-700">MOCK</span> : null}
          </div>

          <nav className="min-w-0 flex-1">
            <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-line bg-white/85 p-1">
              {tabs.map((tab) => {
                const testId = `nav-tab-${String(tab.href).replace(/^\//, "")}`;
                return (
                  <NavTabButton
                    dataTestId={testId}
                    href={tab.href}
                    icon={tab.icon}
                    key={tab.href}
                    label={tab.label}
                  />
                );
              })}
            </div>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
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
