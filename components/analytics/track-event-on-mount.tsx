"use client";

import { useEffect, useRef } from "react";
import { trackClientEvent } from "@/lib/analytics/client";
import type { AnalyticsEventName } from "@/lib/analytics/events";

type TrackEventOnMountProps = {
  event: AnalyticsEventName;
  properties?: Record<string, unknown>;
};

export function TrackEventOnMount({ event, properties }: TrackEventOnMountProps) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) {
      return;
    }
    trackedRef.current = true;
    void trackClientEvent(event, properties ?? {});
  }, [event, properties]);

  return null;
}
