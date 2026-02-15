import Link from "next/link";
import type { Route } from "next";
import { CalendarDays, Search, Settings, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/(app)/actions";
import { isMockMode } from "@/lib/mock-mode";
import { BrandLogo } from "@/components/brand-logo";

const tabs: Array<{ href: Route; label: string; icon: typeof CalendarDays }> = [
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/people", label: "조직도", icon: Search },
  { href: "/settings", label: "설정", icon: Settings }
];

export async function TopNav() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-30 pt-3">
      <div className="page-wrap">
        <div className="panel-glass card flex flex-wrap items-center justify-between gap-3 px-3 py-3 md:px-4">
          <div className="flex items-center gap-2">
            <Link className="inline-flex items-center" href="/calendar">
              <BrandLogo compact />
            </Link>
            {isMockMode ? <span className="badge border-sky-200 bg-sky-50 text-sky-700">MOCK</span> : null}
          </div>

          <nav className="order-3 w-full md:order-2 md:w-auto">
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-white/85 p-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Link
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-accent/10 hover:text-accent sm:gap-2 sm:px-3 sm:text-sm"
                    href={tab.href}
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
            {user ? (
              <>
                <span className="hidden max-w-44 truncate rounded-full border border-line bg-white/90 px-3 py-1.5 text-xs text-muted lg:inline-flex">
                  {user.email}
                </span>
                <form action={signOutAction}>
                  <button className="btn btn-secondary px-3 py-1.5" type="submit">
                    <LogOut size={14} />
                    <span className="hidden sm:inline">로그아웃</span>
                  </button>
                </form>
              </>
            ) : (
              <Link className="btn btn-secondary px-3 py-1.5" href="/login">
                로그인
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
