create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists idx_push_subscriptions_user_active on public.push_subscriptions(user_id, is_active);

create table if not exists public.alert_dedup (
  user_id uuid not null references public.app_users(id) on delete cascade,
  key text not null,
  last_sent_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.push_subscriptions enable row level security;
alter table public.alert_dedup enable row level security;

drop policy if exists "push_subscriptions_owner_all" on public.push_subscriptions;
create policy "push_subscriptions_owner_all" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "alert_dedup_owner_all" on public.alert_dedup;
create policy "alert_dedup_owner_all" on public.alert_dedup
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

