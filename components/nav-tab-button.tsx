"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, CalendarDays, Settings, Users } from "lucide-react";
import { trackClientEvent } from "@/lib/analytics/client";
import { analyticsEvents } from "@/lib/analytics/events";

type TabIcon = "calendar" | "alerts" | "people" | "settings";

type NavTabButtonProps = {
  href: "/calendar" | "/alerts" | "/people" | "/settings";
  label: string;
  icon: TabIcon;
  dataTestId: string;
};

function resolveIcon(icon: TabIcon) {
  if (icon === "calendar") return CalendarDays;
  if (icon === "alerts") return AlertTriangle;
  if (icon === "people") return Users;
  return Settings;
}

export function NavTabButton({ href, label, icon, dataTestId }: NavTabButtonProps) {
  const pathname = usePathname();
  const Icon = resolveIcon(icon);
  const active = pathname === href;

  return (
    <Link
      className={`inline-flex shrink-0 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-[13px] font-medium transition sm:gap-2 sm:px-3 sm:text-sm ${
        active ? "bg-accent/12 text-accent" : "text-slate-700 hover:bg-accent/10 hover:text-accent"
      }`}
      data-testid={dataTestId}
      href={href}
      onClick={() => {
        void trackClientEvent(analyticsEvents.navTabOpened, {
          tab: href.replace("/", ""),
          fromPath: pathname ?? "",
          toPath: href
        });
      }}
      prefetch
    >
      <Icon size={14} />
      <span className="hidden min-[400px]:inline">{label}</span>
    </Link>
  );
}
