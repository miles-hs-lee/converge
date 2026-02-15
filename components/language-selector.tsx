"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/app/(app)/actions";
import { useLocale, useT } from "@/components/locale-provider";
import { type Locale } from "@/lib/i18n";

const options: Array<{ value: Locale; labelKey: "settings.language.ko" | "settings.language.en" | "settings.language.ja" }> = [
  { value: "ko-KR", labelKey: "settings.language.ko" },
  { value: "en-US", labelKey: "settings.language.en" },
  { value: "ja-JP", labelKey: "settings.language.ja" }
];

export function LanguageSelector({ initialLocale }: { initialLocale: Locale }) {
  const t = useT();
  const router = useRouter();
  const { locale, setLocale } = useLocale();
  const [pending, startTransition] = useTransition();

  const current = locale ?? initialLocale;

  return (
    <div className="inline-flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = current === opt.value;
        return (
          <button
            className={`btn ${active ? "btn-primary" : "btn-secondary"} px-3 py-1.5`}
            disabled={pending}
            key={opt.value}
            onClick={() => {
              startTransition(async () => {
                setLocale(opt.value);
                await setLocaleAction(opt.value);
                router.refresh();
              });
            }}
            type="button"
          >
            {t(opt.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

