import Link from "next/link";
import type { Route } from "next";
import { CalendarDays, Search, Settings, Command, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/(app)/actions";
import { isMockMode } from "@/lib/mock-mode";

const tabs: Array<{ href: Route; label: string; icon: typeof CalendarDays }> = [
  { href: "/calendar", label: "통합 캘린더", icon: CalendarDays },
  { href: "/people", label: "조직도", icon: Search },
  { href: "/settings", label: "설정", icon: Settings }
];

export async function TopNav() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-[#f8fbff]/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-accent">Converge</p>
          <p className="text-sm font-medium text-slate-700">Unified workspace for multi-tenant M365</p>
          {isMockMode ? (
            <p className="mt-1 inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700">
              MOCK MODE
            </p>
          ) : null}
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-accent/60"
                href={tab.href}
                key={tab.href}
              >
                <Icon size={16} />
                {tab.label}
              </Link>
            );
          })}

          <button className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-sm text-muted transition hover:border-accent/60">
            <Command size={16} />
            Cmd+K
          </button>

          {user ? (
            <>
              <span className="rounded-full border border-line bg-white px-3 py-2 text-xs text-muted">{user.email}</span>
              <form action={signOutAction}>
                <button
                  className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300"
                  type="submit"
                >
                  <LogOut size={16} />
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <Link
              className="inline-flex items-center rounded-full border border-line bg-white px-3 py-2 text-sm font-medium"
              href="/login"
            >
              로그인
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
