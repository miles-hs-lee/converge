"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "converge-security-reauth-dismissed-v1";

type SecurityReauthModalProps = {
  enabled: boolean;
  title: string;
  body: string;
  ctaLabel: string;
  dismissLabel: string;
  href?: string;
};

export function SecurityReauthModal({
  enabled,
  title,
  body,
  ctaLabel,
  dismissLabel,
  href = "/settings?status=security_reauth_required"
}: SecurityReauthModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      return;
    }

    try {
      const dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
      setOpen(!dismissed);
    } catch {
      setOpen(true);
    }
  }, [enabled]);

  if (!enabled || !open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-amber-300/70 bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{body}</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            className="btn btn-secondary px-3 py-1.5 text-sm"
            onClick={() => {
              try {
                window.localStorage.setItem(DISMISS_KEY, "1");
              } catch {
                // ignore localStorage failures
              }
              setOpen(false);
            }}
            type="button"
          >
            {dismissLabel}
          </button>
          <a className="btn btn-primary px-3 py-1.5 text-sm" href={href}>
            {ctaLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
