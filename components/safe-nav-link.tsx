"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";

type SafeNavLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  dataTestId?: string;
};

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) && event.button === 0;
}

export function SafeNavLink({ href, className, children, dataTestId }: SafeNavLinkProps) {
  const router = useRouter();
  const pendingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current !== null) {
        window.clearTimeout(pendingTimerRef.current);
      }
    };
  }, []);

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(event)) {
      return;
    }

    const targetAttr = event.currentTarget.getAttribute("target");
    if (targetAttr && targetAttr.toLowerCase() !== "_self") {
      return;
    }

    // Let browser default if this click was already consumed upstream.
    if (event.defaultPrevented) {
      return;
    }

    event.preventDefault();

    const beforeHref = window.location.href;
    if (pendingTimerRef.current !== null) {
      window.clearTimeout(pendingTimerRef.current);
    }

    pendingTimerRef.current = window.setTimeout(() => {
      if (window.location.href === beforeHref) {
        // Keep SPA-first behavior; only record potential navigation stall.
        if (typeof window !== "undefined") {
          try {
            const key = "converge_nav_stall_count";
            const prev = Number(window.sessionStorage.getItem(key) ?? "0");
            window.sessionStorage.setItem(key, String(Number.isFinite(prev) ? prev + 1 : 1));
            // eslint-disable-next-line no-console
            console.warn("[ConvergeNav] SPA navigation appears stalled", { href, beforeHref });
          } catch {
            // ignore
          }
        }
      }
    }, 1200);

    try {
      router.push(href as Route);
    } catch {
      if (pendingTimerRef.current !== null) {
        window.clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    }
  };

  return (
    <a className={className} data-testid={dataTestId} href={href} onClick={onClick}>
      {children}
    </a>
  );
}
