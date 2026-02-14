-- Replace email with your authenticated test account email.
-- This seed helps when you want DB-backed testing instead of NEXT_PUBLIC_USE_MOCK mode.

-- 1) ensure app_users row exists
with u as (
  select id, email from auth.users where email = 'your-test-email@company.com' limit 1
)
insert into public.app_users (id, email, name)
select id, email, 'Mock Test User' from u
on conflict (id) do update set updated_at = now();

-- 2) insert mock connection
with u as (
  select id from auth.users where email = 'your-test-email@company.com' limit 1
)
insert into public.m365_connections (
  user_id, provider, tenant_id, tenant_name, m365_user_id, m365_user_principal_name,
  access_token_enc, refresh_token_enc, token_expires_at, scopes, is_primary, status
)
select
  id,
  'microsoft',
  'tenant-demo-1',
  'Primary Tenant',
  'demo-user-1',
  'you@primary.contoso.com',
  'mock_access_token',
  'mock_refresh_token',
  now() + interval '7 days',
  array['User.Read', 'Calendars.Read', 'User.ReadBasic.All'],
  true,
  'active'
from u
on conflict (user_id, tenant_id, m365_user_id) do update set updated_at = now();

-- 3) insert calendar source
with c as (
  select id from public.m365_connections
  where tenant_id = 'tenant-demo-1'
  order by created_at asc
  limit 1
)
insert into public.calendar_sources (connection_id, external_calendar_id, name, color, is_selected)
select id, 'cal-demo-1', 'Primary Calendar', '#0ea5e9', true from c
on conflict (connection_id, external_calendar_id) do update set name = excluded.name;

-- 4) insert mock events
with c as (
  select id as connection_id from public.m365_connections
  where tenant_id = 'tenant-demo-1'
  order by created_at asc
  limit 1
), s as (
  select id as source_id from public.calendar_sources
  where external_calendar_id = 'cal-demo-1'
  order by created_at asc
  limit 1
)
insert into public.calendar_events_cache (
  connection_id, calendar_source_id, external_event_id, subject,
  start_at, end_at, location, organizer
)
select
  c.connection_id,
  s.source_id,
  'evt-demo-1',
  'Mock Product Sync',
  now() + interval '1 hour',
  now() + interval '2 hour',
  'Microsoft Teams',
  'you@primary.contoso.com'
from c, s
on conflict (connection_id, external_event_id) do update set synced_at = now();

-- 5) insert mock people
with c as (
  select id as connection_id from public.m365_connections
  where tenant_id = 'tenant-demo-1'
  order by created_at asc
  limit 1
)
insert into public.people_cache (
  connection_id, external_person_id, display_name, mail, job_title, department
)
select connection_id, 'p-demo-1', '김민수', 'minsu@primary.contoso.com', 'Platform Engineer', 'Platform' from c
on conflict (connection_id, external_person_id) do update set synced_at = now();
