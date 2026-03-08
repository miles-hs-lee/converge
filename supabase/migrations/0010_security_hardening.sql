-- Security hardening:
-- 1) Move OAuth secrets out of user-readable connection rows.
-- 2) Force one-time token rotation for legacy tokens (reauth required).
-- 3) Add DB-backed rate-limit primitive for abuse protection.

create table if not exists public.oauth_connection_secrets (
  connection_id uuid primary key references public.m365_connections(id) on delete cascade,
  access_token_enc text not null,
  refresh_token_enc text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.oauth_connection_secrets enable row level security;

drop policy if exists "oauth_connection_secrets_deny_all" on public.oauth_connection_secrets;
create policy "oauth_connection_secrets_deny_all" on public.oauth_connection_secrets
  for all using (false) with check (false);

with rotated as (
  update public.m365_connections
  set
    status = 'revoked',
    sync_state = coalesce(sync_state, '{}'::jsonb) || jsonb_build_object(
      'security',
      jsonb_build_object(
        'reauthRequired', true,
        'reason', 'token_rotation_2026_02_21',
        'at', now()
      )
    ),
    updated_at = now()
  where status = 'active'
    and (
      coalesce(access_token_enc, '') <> '__migrated__'
      or coalesce(refresh_token_enc, '') <> '__migrated__'
    )
  returning id
)
delete from public.oauth_connection_secrets sec
using rotated r
where sec.connection_id = r.id;

update public.m365_connections
set
  access_token_enc = '__migrated__',
  refresh_token_enc = '__migrated__'
where
  coalesce(access_token_enc, '') <> '__migrated__'
  or coalesce(refresh_token_enc, '') <> '__migrated__';

alter table public.m365_connections
  alter column access_token_enc set default '__migrated__',
  alter column refresh_token_enc set default '__migrated__';

create table if not exists public.request_rate_limits (
  scope text not null,
  actor text not null,
  bucket_start timestamptz not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (scope, actor, bucket_start)
);

create index if not exists idx_request_rate_limits_updated_at
  on public.request_rate_limits(updated_at desc);

alter table public.request_rate_limits enable row level security;

drop policy if exists "request_rate_limits_deny_all" on public.request_rate_limits;
create policy "request_rate_limits_deny_all" on public.request_rate_limits
  for all using (false) with check (false);

create or replace function public.consume_rate_limit(
  p_scope text,
  p_actor text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket_start timestamptz;
  v_count integer;
begin
  if p_scope is null or p_actor is null or p_limit <= 0 or p_window_seconds <= 0 then
    return false;
  end if;

  v_bucket_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.request_rate_limits(scope, actor, bucket_start, count, updated_at)
  values (p_scope, p_actor, v_bucket_start, 1, now())
  on conflict (scope, actor, bucket_start)
  do update set
    count = public.request_rate_limits.count + 1,
    updated_at = now()
  returning count into v_count;

  delete from public.request_rate_limits
  where updated_at < now() - interval '2 days';

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public;
revoke all on function public.consume_rate_limit(text, text, integer, integer) from anon;
revoke all on function public.consume_rate_limit(text, text, integer, integer) from authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
