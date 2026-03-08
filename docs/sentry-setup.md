# Sentry Setup (Converge)

This project uses Sentry for runtime error monitoring in Next.js (App Router).

## What Is Included

- Client runtime init: `instrumentation-client.ts`
- Server/Edge runtime init: `sentry.server.config.ts`, `sentry.edge.config.ts`
- Next.js instrumentation hook: `instrumentation.ts`
- Global app error boundary reporting: `app/global-error.tsx`
- Build integration + source map upload: `next.config.ts` (`withSentryConfig`)
- Tunnel route enabled (default): `/monitoring`

## Why This Helps

- Faster root cause analysis for production failures.
- Clear regression detection per release (`NEXT_PUBLIC_BUILD_SHA`).
- Better visibility into auth/sync failures without blocking user flow.
- Browser-extension noise filtering to reduce alert fatigue.

## Data Safety Defaults

- `sendDefaultPii: false` for client/server/edge.
- `beforeSend` applies:
  - browser extension noise drop
  - token/secret/password/cookie key redaction
  - user data minimization (ID only)

## Required Environment Variables

Runtime:

- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_DSN` (optional; fallback to public DSN)
- `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` (default `0.05`)
- `SENTRY_TRACES_SAMPLE_RATE` (default `0.1`)
- `SENTRY_ENVIRONMENT` / `NEXT_PUBLIC_SENTRY_ENVIRONMENT` (optional)

Build (for source maps):

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Optional:

- `SENTRY_TUNNEL_ROUTE` (default `/monitoring`)

## Recommended Vercel Setup

Set all variables in:

- Production
- Preview
- Development

After setting env vars, trigger a fresh production deploy.

## Current Scope

- Included: web runtime, API routes, server actions, post-login sync path.
- Excluded intentionally: cron routes (per current project decision).
