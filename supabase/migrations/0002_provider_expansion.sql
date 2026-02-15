-- Prepare connection records for multi-provider integrations (Microsoft + Google)
alter table public.m365_connections
  add column if not exists provider_meta jsonb not null default '{}'::jsonb,
  add column if not exists sync_state jsonb not null default '{}'::jsonb;

create index if not exists idx_connections_user_provider_status
  on public.m365_connections(user_id, provider, status);

create index if not exists idx_connections_provider_identity
  on public.m365_connections(provider, tenant_id, m365_user_id);
