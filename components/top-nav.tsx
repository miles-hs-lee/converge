import Link from "next/link";
import { CalendarDays, Search, Settings, Command } from "lucide-react";

const tabs = [
  { href: "/calendar", label: "통합 캘린더", icon: CalendarDays },
  { href: "/people", label: "조직도", icon: Search },
  { href: "/settings", label: "설정", icon: Settings }
];

export function TopNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Converge</p>
          <p className="text-sm font-medium">Multi-tenant M365 Workspace</p>
        </div>
        <nav className="flex items-center gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-2 text-sm font-medium transition hover:border-accent/60"
                href={tab.href}
                key={tab.href}
              >
                <Icon size={16} />
                {tab.label}
              </Link>
            );
          })}
          <button className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-2 text-sm text-muted transition hover:border-accent/60">
            <Command size={16} />
            Cmd+K
          </button>
        </nav>
      </div>
    </header>
  );
}
