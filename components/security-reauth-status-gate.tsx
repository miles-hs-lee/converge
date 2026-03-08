"use client";

import { useEffect, useState } from "react";
import { SecurityReauthModal } from "@/components/security-reauth-modal";

type SecurityReauthStatusGateProps = {
  title: string;
  body: string;
  ctaLabel: string;
  dismissLabel: string;
};

export function SecurityReauthStatusGate({ title, body, ctaLabel, dismissLabel }: SecurityReauthStatusGateProps) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let disposed = false;

    const run = async () => {
      try {
        const response = await fetch("/api/auth/reauth-status", { credentials: "include" });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { needsReauth?: boolean };
        if (!disposed) {
          setEnabled(Boolean(payload.needsReauth));
        }
      } catch {
        // Silent failure by design: this check is best-effort and should not block rendering.
      }
    };

    void run();
    return () => {
      disposed = true;
    };
  }, []);

  return <SecurityReauthModal body={body} ctaLabel={ctaLabel} dismissLabel={dismissLabel} enabled={enabled} title={title} />;
}
