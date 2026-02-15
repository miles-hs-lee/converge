"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/components/locale-provider";

type UserChoiceOutcome = "accepted" | "dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: UserChoiceOutcome }>;
};

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod");
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const anyNavigator = navigator as unknown as { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)")?.matches || Boolean(anyNavigator.standalone);
}

export function PwaInstall() {
  const t = useT();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    const onBeforeInstall = (e: Event) => {
      // Allow custom UI instead of the mini-infobar.
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall as EventListener);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall as EventListener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const ios = useMemo(() => isIos(), []);

  if (installed) {
    return <p className="mt-3 text-sm text-muted">{t("pwa.installed")}</p>;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {promptEvent ? (
        <button
          className="btn btn-primary"
          onClick={async () => {
            try {
              await promptEvent.prompt();
              await promptEvent.userChoice;
              setPromptEvent(null);
            } catch {
              // best-effort
            }
          }}
          type="button"
        >
          {t("pwa.cta")}
        </button>
      ) : (
        <span className="text-sm text-muted">
          {t("pwa.unavailable")} {ios ? t("pwa.iosHint") : null}
        </span>
      )}
    </div>
  );
}

