"use client";

import { useEffect } from "react";
import { setClientAnalyticsIdentity } from "@/lib/analytics/client";

type AnalyticsIdentityProps = {
  userId?: string | null;
};

export function AnalyticsIdentity({ userId }: AnalyticsIdentityProps) {
  useEffect(() => {
    setClientAnalyticsIdentity(userId ?? null);
  }, [userId]);

  return null;
}
