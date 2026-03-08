import * as Sentry from "@sentry/nextjs";
import { parseSampleRate, sanitizeSentryEvent, shouldDropSentryEvent } from "@/lib/observability/sentry-filters";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_BUILD_SHA || undefined,
  sendDefaultPii: false,
  tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1),
  beforeSendTransaction(event) {
    if (shouldDropSentryEvent(event)) {
      return null;
    }
    return sanitizeSentryEvent(event);
  },
  beforeSend(event) {
    if (shouldDropSentryEvent(event)) {
      return null;
    }
    return sanitizeSentryEvent(event);
  }
});
