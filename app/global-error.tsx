"use client";

import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    void import("@sentry/nextjs").then((Sentry) => {
      Sentry.captureException(error);
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="page-wrap flex min-h-screen items-center justify-center py-14">
          <section className="panel-glass card max-w-lg p-7 md:p-9">
            <h1 className="title-xl">Something went wrong.</h1>
            <p className="muted mt-2">The issue has been reported. Please try again.</p>
            <button className="btn btn-primary mt-5" onClick={reset} type="button">
              Retry
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
