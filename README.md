# Converge

Converge is a unified workspace for people using Microsoft 365 across multiple tenants.

## Tech Stack

- Next.js 15 (App Router) + TypeScript
- Supabase (Auth, Postgres, RLS)
- Microsoft Graph API (multi-tenant OAuth)
- Tailwind CSS

## Implemented Starter Scope

- Onboarding page: `/onboarding`
- Login page: `/login`
- Core tabs:
  - Unified Calendar: `/calendar`
  - People Search: `/people`
  - Settings (connect extra M365 accounts): `/settings`
- Initial Supabase schema and RLS policy:
  - `supabase/migrations/0001_init.sql`

## Local Setup

1. Install packages

```bash
npm install
```

2. Create local env

```bash
cp .env.example .env.local
```

3. Fill env values from Supabase and Azure App Registration.
   - Supabase Auth redirect URL must include:
     - `http://localhost:3000/auth/callback`
   - Azure Redirect URI must include:
     - `http://localhost:3000/api/auth/microsoft/callback`

4. Run migration SQL in Supabase SQL editor:

- `/Users/cnt-22-70004/Documents/Converge/supabase/migrations/0001_init.sql`

5. Start app

```bash
npm run dev
```

## Next Implementation Tasks

1. Microsoft refresh token rotation and secure token encryption at rest
2. Account disconnect/reconnect action in settings page
3. Calendar sync job and people sync job via server routes or edge functions
4. Calendar and people pages connected to real DB data
5. Global command palette (`Cmd/Ctrl+K`) and keyboard shortcuts
