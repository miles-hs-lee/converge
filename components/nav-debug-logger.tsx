"use client";

import { useEffect, useState } from "react";

const BUFFER_KEY = "converge_nav_debug_buffer";

declare global {
  interface Window {
    __convergeNavDebug?: {
      enable: () => void;
      disable: () => void;
      enabled: boolean;
    };
  }
}

function readEnabledFlag(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const queryFlag = params.get("debugNav");
  return queryFlag === "1";
}

function formatElement(el: Element | null): string {
  if (!el) return "(null)";
  const htmlEl = el as HTMLElement;
  const id = htmlEl.id ? `#${htmlEl.id}` : "";
  const classes = htmlEl.className
    ? `.${String(htmlEl.className)
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .join(".")}`
    : "";
  const testId = htmlEl.getAttribute?.("data-testid");
  return `${htmlEl.tagName.toLowerCase()}${id}${classes}${testId ? ` [data-testid=${testId}]` : ""}`;
}

function isNavClickTarget(el: Element | null): boolean {
  if (!el) return false;
  return Boolean(el.closest("[data-testid^='nav-tab-'], [data-testid='nav-brand'], [data-testid='nav-login']"));
}

export function NavDebugLogger() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const next = readEnabledFlag();
    setEnabled(next);
    window.__convergeNavDebug = {
      enable: () => {
        setEnabled(true);
        console.info("[ConvergeNavDebug] enabled");
      },
      disable: () => {
        setEnabled(false);
        console.info("[ConvergeNavDebug] disabled");
      },
      enabled: next
    };
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const appendBuffered = (entry: string) => {
      try {
        const raw = window.sessionStorage.getItem(BUFFER_KEY);
        const list = raw ? (JSON.parse(raw) as string[]) : [];
        const next = [...list.slice(-149), entry];
        window.sessionStorage.setItem(BUFFER_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    };

    const log = (label: string, data?: Record<string, unknown>) => {
      const stamp = new Date().toISOString();
      const line = data ? `[ConvergeNavDebug ${stamp}] ${label} ${JSON.stringify(data)}` : `[ConvergeNavDebug ${stamp}] ${label}`;
      appendBuffered(line);
      if (data) {
        console.log(`[ConvergeNavDebug ${stamp}] ${label}`, data);
      } else {
        console.log(`[ConvergeNavDebug ${stamp}] ${label}`);
      }
    };

    try {
      const raw = window.sessionStorage.getItem(BUFFER_KEY);
      if (raw) {
        const list = JSON.parse(raw) as string[];
        if (Array.isArray(list) && list.length > 0) {
          console.groupCollapsed("[ConvergeNavDebug] previous buffered logs");
          list.slice(-30).forEach((line) => console.log(line));
          console.groupEnd();
        }
      }
    } catch {
      // ignore
    }

    log("session.start", {
      href: window.location.href,
      userAgent: navigator.userAgent,
      serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller)
    });

    const pushStateOriginal = window.history.pushState.bind(window.history);
    const replaceStateOriginal = window.history.replaceState.bind(window.history);
    const fetchOriginal = window.fetch.bind(window);

    window.history.pushState = function pushStatePatched(state: unknown, unused: string, url?: string | URL | null) {
      log("history.pushState", { url: url ? String(url) : null, state });
      return pushStateOriginal(state, unused, url);
    };

    window.history.replaceState = function replaceStatePatched(state: unknown, unused: string, url?: string | URL | null) {
      log("history.replaceState", { url: url ? String(url) : null, state });
      return replaceStateOriginal(state, unused, url);
    };

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const [input, init] = args;
      const method = init?.method ?? (input instanceof Request ? input.method : "GET");
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const navLike = url.includes("_rsc=") || url.includes("/_next/data/") || url.includes("/alerts") || url.includes("/calendar") || url.includes("/people") || url.includes("/settings");

      if (navLike) {
        log("fetch.start", { method, url });
      }
      try {
        const response = await fetchOriginal(...args);
        if (navLike) {
          log("fetch.end", { method, url, status: response.status });
        }
        return response;
      } catch (error) {
        if (navLike) {
          log("fetch.error", { method, url, error: String(error) });
        }
        throw error;
      }
    };

    const onClickCapture = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const navTarget = target?.closest("[data-testid^='nav-tab-'], [data-testid='nav-brand'], [data-testid='nav-login']") ?? null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!isNavClickTarget(target) && !anchor) return;

      const elements = document.elementsFromPoint(event.clientX, event.clientY).slice(0, 6).map((el) => formatElement(el));
      log("click.capture", {
        x: event.clientX,
        y: event.clientY,
        defaultPrevented: event.defaultPrevented,
        target: formatElement(target),
        navTarget: formatElement(navTarget),
        anchorHref: anchor?.href ?? null,
        currentHref: window.location.href,
        topElements: elements
      });

      window.setTimeout(() => {
        log("click.afterTimeout", { currentHref: window.location.href });
      }, 0);
    };

    const onClickBubble = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!isNavClickTarget(target)) return;
      log("click.bubble", {
        target: formatElement(target),
        defaultPrevented: event.defaultPrevented,
        currentHref: window.location.href
      });
    };

    const onPopState = () => {
      log("history.popstate", { href: window.location.href });
    };

    const onPageShow = (event: PageTransitionEvent) => {
      log("window.pageshow", { href: window.location.href, persisted: event.persisted });
    };

    const onBeforeUnload = () => {
      log("window.beforeunload", { href: window.location.href });
    };

    const onError = (event: ErrorEvent) => {
      log("window.error", {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        col: event.colno
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      log("window.unhandledrejection", { reason: String(event.reason) });
    };

    const onControllerChange = () => {
      log("sw.controllerchange", {
        controlled: Boolean(navigator.serviceWorker?.controller),
        scriptURL: navigator.serviceWorker?.controller?.scriptURL ?? null
      });
    };

    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("click", onClickBubble, false);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);

    return () => {
      window.history.pushState = pushStateOriginal;
      window.history.replaceState = replaceStateOriginal;
      window.fetch = fetchOriginal;
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("click", onClickBubble, false);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
      log("session.end");
    };
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[9999] rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 shadow">
      NAV DEBUG ON
    </div>
  );
}
