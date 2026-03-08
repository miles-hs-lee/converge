"use client";

import { useEffect, useMemo, useState } from "react";
import { useIntlLocale } from "@/components/locale-provider";

type LocalizedDateTimeProps = {
  iso?: string | null;
  emptyText?: string;
  options?: Intl.DateTimeFormatOptions;
};

export function LocalizedDateTime({ iso, emptyText = "-", options }: LocalizedDateTimeProps) {
  const intl = useIntlLocale();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatted = useMemo(() => {
    if (!iso) return emptyText;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return emptyText;
    return date.toLocaleString(intl, options);
  }, [emptyText, intl, iso, options]);

  if (!iso) {
    return <>{emptyText}</>;
  }

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {mounted ? formatted : emptyText}
    </time>
  );
}
