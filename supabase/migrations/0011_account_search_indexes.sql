-- Account-name search support for settings/people runtime flows
create index if not exists idx_connections_user_tenant_name_lower
  on public.m365_connections(user_id, lower(coalesce(tenant_name, '')));

create index if not exists idx_connections_user_principal_lower
  on public.m365_connections(user_id, lower(coalesce(m365_user_principal_name, '')));
