# Converge Analytics Events (Core 10)

This document defines the first 10 product analytics events wired into Converge.

## Event List

1. `converge.onboarding_viewed`
2. `converge.login_viewed`
3. `converge.auth.oauth_start`
4. `converge.auth.oauth_connected`
5. `converge.sync.manual_started`
6. `converge.sync.manual_completed`
7. `converge.calendar.view_mode_changed`
8. `converge.calendar.event_opened`
9. `converge.people.search_submitted`
10. `converge.people.profile_opened`

## Transport

- Client events are sent to `/api/ingest`.
- Server events are sent directly to PostHog `/capture/`.
- If `POSTHOG_API_KEY` is not set, analytics calls are safely skipped.

## Required Environment Variables

- `POSTHOG_API_KEY`
- `POSTHOG_HOST` (optional, default: `https://us.i.posthog.com`)
