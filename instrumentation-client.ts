type SentryModule = typeof import("@sentry/nextjs");

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
let sentryPromise: Promise<SentryModule | null> | null = null;

async function loadSentry(): Promise<SentryModule | null> {
  if (!dsn) {
    return null;
  }
  if (sentryPromise) {
    return sentryPromise;
  }

  sentryPromise = Promise.all([
    import("@sentry/nextjs"),
    import("@/lib/observability/sentry-filters")
  ]).then(([Sentry, filters]) => {
    Sentry.init({
      dsn,
      enabled: true,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
      release: process.env.NEXT_PUBLIC_BUILD_SHA || undefined,
      sendDefaultPii: false,
      tracesSampleRate: filters.parseSampleRate(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, 0.05),
      beforeSendTransaction(event) {
        if (filters.shouldDropSentryEvent(event)) {
          return null;
        }
        return filters.sanitizeSentryEvent(event);
      },
      beforeSend(event) {
        if (filters.shouldDropSentryEvent(event)) {
          return null;
        }
        return filters.sanitizeSentryEvent(event);
      }
    });
    return Sentry;
  });

  return sentryPromise;
}

function scheduleSentryLoad() {
  if (!dsn || typeof window === "undefined") {
    return;
  }
  const trigger = () => {
    void loadSentry();
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(trigger, { timeout: 3_000 });
  } else {
    window.setTimeout(trigger, 2_000);
  }
}

if (typeof window !== "undefined" && dsn) {
  window.addEventListener(
    "error",
    (event) => {
      void loadSentry().then((Sentry) => {
        Sentry?.captureException(event.error ?? new Error(event.message || "client_error"));
      });
    },
    { once: true }
  );
  window.addEventListener(
    "unhandledrejection",
    (event) => {
      void loadSentry().then((Sentry) => {
        Sentry?.captureException(event.reason ?? new Error("unhandled_rejection"));
      });
    },
    { once: true }
  );
  scheduleSentryLoad();
}

export const onRouterTransitionStart = (...args: Parameters<SentryModule["captureRouterTransitionStart"]>) => {
  void loadSentry().then((Sentry) => {
    Sentry?.captureRouterTransitionStart(...args);
  });
};
