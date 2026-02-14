import Link from "next/link";
import type { Route } from "next";
import { CalendarDays, Search, Settings, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/(app)/actions";
import { isMockMode } from "@/lib/mock-mode";

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
    <header className="sticky top-0 z-30 border-b border-line bg-white/88 backdrop-blur-xl">
      <div className="page-wrap flex items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-2">
          <Link className="text-sm font-semibold tracking-tight" href="/calendar">
            Converge
          </Link>
          {isMockMode ? <span className="badge border-sky-200 bg-sky-50 text-sky-700">MOCK</span> : null}
        </div>

        <nav className="flex items-center gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link className="btn btn-secondary px-3 py-1.5" href={tab.href} key={tab.href}>
                <Icon size={14} />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden max-w-44 truncate rounded-full border border-line bg-white px-3 py-1.5 text-xs text-muted md:inline-flex">
                {user.email}
              </span>
              <form action={signOutAction}>
                <button className="btn btn-secondary px-3 py-1.5" type="submit">
                  <LogOut size={14} />
                  로그아웃
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
    </header>
  );
}
