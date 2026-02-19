-- Expand Graph-backed cache fields for richer event/person detail views.

alter table public.calendar_events_cache
  add column if not exists body_preview text,
  add column if not exists importance text,
  add column if not exists sensitivity text,
  add column if not exists show_as text,
  add column if not exists response_status text,
  add column if not exists response_time timestamptz,
  add column if not exists is_cancelled boolean not null default false,
  add column if not exists is_online_meeting boolean not null default false,
  add column if not exists online_meeting_url text,
  add column if not exists organizer_name text,
  add column if not exists event_type text,
  add column if not exists categories text[] not null default '{}',
  add column if not exists timezone_start text,
  add column if not exists timezone_end text,
  add column if not exists recurrence jsonb not null default '{}'::jsonb,
  add column if not exists created_external timestamptz,
  add column if not exists raw jsonb not null default '{}'::jsonb;

create index if not exists idx_events_importance on public.calendar_events_cache(importance);
create index if not exists idx_events_show_as on public.calendar_events_cache(show_as);
create index if not exists idx_events_is_online_meeting on public.calendar_events_cache(is_online_meeting);

alter table public.people_cache
  add column if not exists given_name text,
  add column if not exists surname text,
  add column if not exists user_principal_name text,
  add column if not exists company_name text,
  add column if not exists employee_id text,
  add column if not exists preferred_language text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists country text,
  add column if not exists user_type text,
  add column if not exists account_enabled boolean;

create index if not exists idx_people_upn on public.people_cache using gin (lower(coalesce(user_principal_name, '')) gin_trgm_ops);
create index if not exists idx_people_employee_id on public.people_cache using gin (lower(coalesce(employee_id, '')) gin_trgm_ops);
