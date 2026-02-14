create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  locale text default 'ko-KR',
  timezone text default 'Asia/Seoul',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.m365_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  provider text not null default 'microsoft',
  tenant_id text not null,
  tenant_name text,
  m365_user_id text not null,
  m365_user_principal_name text,
  access_token_enc text not null,
  refresh_token_enc text not null,
  token_expires_at timestamptz not null,
  scopes text[] not null default '{}',
  is_primary boolean not null default false,
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tenant_id, m365_user_id)
);

create table if not exists public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.m365_connections(id) on delete cascade,
  external_calendar_id text not null,
  name text not null,
  color text,
  is_selected boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (connection_id, external_calendar_id)
);

create table if not exists public.calendar_events_cache (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.m365_connections(id) on delete cascade,
  calendar_source_id uuid not null references public.calendar_sources(id) on delete cascade,
  external_event_id text not null,
  subject text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  is_all_day boolean not null default false,
  location text,
  organizer text,
  attendees jsonb not null default '[]'::jsonb,
  web_link text,
  last_modified_external timestamptz,
  synced_at timestamptz not null default now(),
  unique (connection_id, external_event_id)
);

create table if not exists public.people_cache (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.m365_connections(id) on delete cascade,
  external_person_id text not null,
  display_name text not null,
  mail text,
  job_title text,
  department text,
  office_location text,
  mobile_phone text,
  business_phones text[] not null default '{}',
  manager_external_id text,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (connection_id, external_person_id)
);

create table if not exists public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  connection_id uuid not null references public.m365_connections(id) on delete cascade,
  job_type text not null check (job_type in ('calendar', 'people')),
  status text not null check (status in ('queued', 'running', 'success', 'failed')),
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_connections_user_status on public.m365_connections(user_id, status);
create index if not exists idx_events_window on public.calendar_events_cache(start_at, end_at);
create index if not exists idx_people_display_name on public.people_cache using gin (lower(display_name) gin_trgm_ops);
create index if not exists idx_people_mail on public.people_cache using gin (lower(coalesce(mail, '')) gin_trgm_ops);
create index if not exists idx_people_department on public.people_cache using gin (lower(coalesce(department, '')) gin_trgm_ops);

alter table public.app_users enable row level security;
alter table public.m365_connections enable row level security;
alter table public.calendar_sources enable row level security;
alter table public.calendar_events_cache enable row level security;
alter table public.people_cache enable row level security;
alter table public.sync_jobs enable row level security;

drop policy if exists "app_users_select_own" on public.app_users;
create policy "app_users_select_own" on public.app_users
  for select using (auth.uid() = id);

drop policy if exists "app_users_insert_own" on public.app_users;
create policy "app_users_insert_own" on public.app_users
  for insert with check (auth.uid() = id);

drop policy if exists "app_users_update_own" on public.app_users;
create policy "app_users_update_own" on public.app_users
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "connections_owner_all" on public.m365_connections;
create policy "connections_owner_all" on public.m365_connections
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "calendar_sources_owner_all" on public.calendar_sources;
create policy "calendar_sources_owner_all" on public.calendar_sources
  for all using (
    exists (
      select 1 from public.m365_connections c
      where c.id = calendar_sources.connection_id
      and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.m365_connections c
      where c.id = calendar_sources.connection_id
      and c.user_id = auth.uid()
    )
  );

drop policy if exists "events_owner_all" on public.calendar_events_cache;
create policy "events_owner_all" on public.calendar_events_cache
  for all using (
    exists (
      select 1 from public.m365_connections c
      where c.id = calendar_events_cache.connection_id
      and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.m365_connections c
      where c.id = calendar_events_cache.connection_id
      and c.user_id = auth.uid()
    )
  );

drop policy if exists "people_owner_all" on public.people_cache;
create policy "people_owner_all" on public.people_cache
  for all using (
    exists (
      select 1 from public.m365_connections c
      where c.id = people_cache.connection_id
      and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.m365_connections c
      where c.id = people_cache.connection_id
      and c.user_id = auth.uid()
    )
  );

drop policy if exists "sync_jobs_owner_all" on public.sync_jobs;
create policy "sync_jobs_owner_all" on public.sync_jobs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
