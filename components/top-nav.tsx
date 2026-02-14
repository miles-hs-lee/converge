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
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Link className="text-sm font-semibold tracking-tight" href="/calendar">
            Converge
          </Link>
          {isMockMode ? (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
              MOCK
            </span>
          ) : null}
        </div>

        <nav className="flex items-center gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-accent/60"
                href={tab.href}
                key={tab.href}
              >
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
                <button
                  className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-rose-300 hover:text-rose-700"
                  type="submit"
                >
                  <LogOut size={14} />
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <Link className="rounded-full border border-line bg-white px-3 py-1.5 text-sm" href="/login">
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
